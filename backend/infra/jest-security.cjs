const path=require('node:path');
module.exports={rootDir:path.resolve(__dirname,'../piattaforma/packages/api'),testEnvironment:'node',testMatch:['**/connectors/__tests__/*.unit.spec.ts','**/outfit/__tests__/*.unit.spec.ts','**/scripts/__tests__/*.unit.spec.ts'],transform:{'^.+\\.ts$':path.join(__dirname,'ts-jest.cjs')},cache:false};
