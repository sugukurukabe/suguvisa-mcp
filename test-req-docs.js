import { getRequiredDocumentsData } from "./dist/tools/required-documents.js";
import fs from "fs";

async function run() {
    const res = getRequiredDocumentsData({
        pattern_id: "CHANGE_SSW1_A",
        support_type: "delegated",
        industry_field: "農業",
        employer_type: "individual",
        is_domestic: true,
        is_same_employer_2year: false
    });
    fs.writeFileSync("req-docs-output2.json", JSON.stringify(res, null, 2), "utf8");
}

run();
