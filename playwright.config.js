const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'./tests',
  testMatch:'*.spec.js',
  fullyParallel:true,
  use:{baseURL:'http://127.0.0.1:4174',headless:true},
  webServer:{command:'npm start',env:{PORT:'4174'},url:'http://127.0.0.1:4174',reuseExistingServer:false},
  reporter:'list'
});
