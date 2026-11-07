import {passwordSeedDemo} from '../demo-policy'
describe('seed demo esplicito',()=>{
  it.each([{}, {NODE_ENV:'production',DEMO_SEED_ENABLED:'true',DEMO_SEED_PASSWORD:'password-individuale-test'}, {NODE_ENV:'development'}, {NODE_ENV:'test',DEMO_SEED_ENABLED:'true'}, {NODE_ENV:'test',DEMO_SEED_ENABLED:'true',DEMO_SEED_PASSWORD:'short'}])('rifiuta la configurazione non autorizzata',env=>expect(()=>passwordSeedDemo(env)).toThrow())
  it.each(['development','test'])('permette il demo esplicito in %s',NODE_ENV=>expect(passwordSeedDemo({NODE_ENV,DEMO_SEED_ENABLED:'true',DEMO_SEED_PASSWORD:'password-individuale-test'})).toBe('password-individuale-test'))
})
