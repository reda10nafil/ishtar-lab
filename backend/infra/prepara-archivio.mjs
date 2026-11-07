import path from 'node:path';
import { createRequire } from 'node:module';
import { RADICE, verificaIsolamento } from './istanza.mjs';
const env=verificaIsolamento();
const require=createRequire(path.join(RADICE,'piattaforma/packages/api/package.json'));
const provider=require.resolve('@medusajs/medusa/file-s3');
const {S3Client,HeadBucketCommand,CreateBucketCommand,PutBucketPolicyCommand}=createRequire(provider)('@aws-sdk/client-s3');
const client=new S3Client({endpoint:env.S3_ENDPOINT,region:env.S3_REGION,forcePathStyle:true,maxAttempts:2,credentials:{accessKeyId:env.S3_ACCESS_KEY_ID,secretAccessKey:env.S3_SECRET_ACCESS_KEY}});
try{
  try{await client.send(new HeadBucketCommand({Bucket:env.S3_BUCKET}));}
  catch(e){if(e.$metadata?.httpStatusCode!==404)throw e;await client.send(new CreateBucketCommand({Bucket:env.S3_BUCKET}));}
  await client.send(new PutBucketPolicyCommand({Bucket:env.S3_BUCKET,Policy:JSON.stringify({Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:'*',Action:['s3:GetObject'],Resource:[`arn:aws:s3:::${env.S3_BUCKET}/*`]}]})}));
  console.log('Archivio locale Ishtar Lab pronto; nessun file del vecchio archivio usato.');
}catch(e){console.error(`Preparazione archivio non completata: ${e.name}, HTTP ${e.$metadata?.httpStatusCode??'n/a'}`);process.exitCode=1;}
finally{client.destroy();}
