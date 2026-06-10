import axios from 'axios';

async function main() {
  const url = 'https://firestore.googleapis.com/v1/projects/studio-6350931931-426d4/databases/(default)/documents/erp_items';
  console.log(`GET ${url}`);
  try {
    const res = await axios.get(url);
    console.log('✅ Success! Status:', res.status);
    console.log('Documents count:', res.data.documents ? res.data.documents.length : 0);
  } catch (err: any) {
    console.error('❌ Failed!');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Error data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}

main();
