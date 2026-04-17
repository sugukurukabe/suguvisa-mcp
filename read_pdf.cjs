const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = 'C:\\Users\\k_jim\\OneDrive\\デスクトップ\\suguvisa-mcp\\suguvisa-mcp - MCP _ Smithery.pdf';
const dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function(data) {
  console.log(data.text);
}).catch(console.error);
