'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const base=__dirname;
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.json':'application/json; charset=utf-8'};

const server=http.createServer((req,res)=>{
  let parsedUrl;
  try{parsedUrl=new URL(req.url,'http://localhost');}
  catch{res.writeHead(400);res.end('Adresse invalide');return;}

  if(req.method==='POST' && parsedUrl.pathname==='/api/import-match-pdf'){
    const chunks=[];
    let size=0;
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>50*1024*1024){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Fichiers trop volumineux (max 50 Mo)'}));req.destroy();return;}
      chunks.push(chunk);
    });
    req.on('end',()=>{
      const buffer=Buffer.concat(chunks);
      const contentType=req.headers['content-type']||'';
      const boundaryMatch=contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if(!boundaryMatch){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Type de requête multipart invalide'}));return;}
      const boundary=boundaryMatch[1]||boundaryMatch[2];
      const parts=buffer.toString('binary').split('--'+boundary);
      const files=[];
      const tmpDir=fs.mkdtempSync(path.join('/tmp','bcf-upload-'));

      for(const part of parts){
        if(part.includes('Content-Disposition') && part.includes('filename=')){
          const match=part.match(/filename="([^"]+)"/);
          if(match){
            const originalName=path.basename(match[1]);
            const headerEnd=part.indexOf('\r\n\r\n');
            if(headerEnd!==-1){
              let fileData=part.slice(headerEnd+4);
              if(fileData.endsWith('\r\n')) fileData=fileData.slice(0,-2);
              const filePath=path.join(tmpDir,originalName);
              fs.writeFileSync(filePath,Buffer.from(fileData,'binary'));
              files.push(filePath);
            }
          }
        }
      }

      if(!files.length){
        fs.rmSync(tmpDir,{recursive:true,force:true});
        res.writeHead(400,{'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'Aucun fichier PDF reçu.'}));
        return;
      }

      const pythonPath='/Users/mac-MCREPI09/.copilot/session-state/54dd2d86-7947-41ab-9b99-87288d549f01/files/pdf-tools/bin/python3';
      const scriptPath=path.join(base,'parse_match_pdf.py');
      const py=spawn(pythonPath,[scriptPath,...files]);
      let pyOut='',pyErr='';
      py.stdout.on('data',d=>pyOut+=d.toString());
      py.stderr.on('data',d=>pyErr+=d.toString());
      py.on('close',code=>{
        fs.rmSync(tmpDir,{recursive:true,force:true});
        if(code!==0){
          let errMessage='Erreur d’extraction PDF';
          try{const parsed=JSON.parse(pyOut);if(parsed.error)errMessage=parsed.error;}catch{}
          res.writeHead(422,{'Content-Type':'application/json'});
          res.end(JSON.stringify({error:errMessage,details:pyErr}));
          return;
        }
        try{
          const matchData=JSON.parse(pyOut);
          res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
          res.end(JSON.stringify(matchData));
        }catch(e){
          res.writeHead(500,{'Content-Type':'application/json'});
          res.end(JSON.stringify({error:'Réponse du parseur invalide',raw:pyOut}));
        }
      });
    });
    return;
  }

  if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const filename=decodeURIComponent(parsedUrl.pathname);
  const allowed=['/','/index.html','/styles.css','/data.js','/history-2025.js','/history-2026.js','/app.js'];
  if(!allowed.includes(filename) && !/^\/assets\/[a-z]+\.jpg$/.test(filename) && !/^\/shotmaps\/\d{4}-[ab]\.jpg$/.test(filename)){res.writeHead(404);res.end('Introuvable');return;}
  const target=path.join(base,filename==='/'?'index.html':filename);
  fs.readFile(target,(error,buffer)=>{
    if(error){res.writeHead(error.code==='ENOENT'?404:500);res.end('Fichier indisponible');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(target)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?undefined:buffer);
  });
});

server.on('error',error=>{console.error(`Démarrage impossible : ${error.message}`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`BCF Analytics : http://127.0.0.1:${port}`));
