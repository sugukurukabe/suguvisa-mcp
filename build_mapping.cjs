const fs = require('fs');

const dump = JSON.parse(fs.readFileSync('xlsm_headers_dump.json', 'utf8'));
const headers = dump.Row_5; // 0-based array

const mapping = {};
headers.forEach((h, i) => {
    if (h) {
        // exceljs/xlsx-populate uses 1-based indexing for columns
        mapping[h] = i + 1;
    }
});

fs.writeFileSync("isa_column_map.json", JSON.stringify(mapping, null, 2));
console.log("Mapped columns to 1-based indexes");
