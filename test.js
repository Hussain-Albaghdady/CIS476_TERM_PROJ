const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = require ("./atlas_uri")

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
const dbname="RentFlicks"
let db;

async function connectToDB() {
  if(!db)
    { 
    try {
      await client.connect();
      db= client.db(dbname);
      console.log(` Successfully connected to the ${dbname} database`);
    } catch(err) {
      console.log(` MongoDB connection failed to the ${dbname} database`,err);
    }
  }
  return db;
}
module.exports=connectToDB;
