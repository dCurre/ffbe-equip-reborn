import firebase from 'firebase-admin'
let admin = firebase
import ServerConfig from '../../config.js';

let config = ServerConfig.ServerConfig

// Only initialize Firebase when enabled: placeholder credentials make cert() throw at startup
export var bucket = null;
if (config.firebase.enabled) {
  admin.initializeApp({
    credential: admin.credential.cert(config.firebase.configuration),
    databaseURL: "https://" + config.firebase.databaseId + ".appspot.com"
  });
  bucket = admin.storage().bucket("gs://" + config.firebase.bucketUri);
}

export default { bucket }
