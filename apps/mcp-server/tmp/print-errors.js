const fs = require('fs');
const json = JSON.parse(fs.readFileSync('out_docs.json', 'utf8'));
json.testResults[0].assertionResults.forEach(r => {
  if (r.status === 'failed') {
    console.log(`Failed: ${r.title}`);
    console.log(r.failureMessages.join('\n'));
    console.log('---');
  }
});
