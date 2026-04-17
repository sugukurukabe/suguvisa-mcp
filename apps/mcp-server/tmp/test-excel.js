import { createOfflineExcel } from "./dist/tools/generate-annual-report-offline.js";

async function main() {
  const dummy = [
     {
        residence_card_number: "AA00000000AA", family_name_romaji: "TEST", given_name_romaji: "USER",
        date_of_birth: "20000101", sex: "1", working_days: "60", paid_leave_days: "2",
        monthly_salary_average: "220000", support_interview_date: "20260315", support_status_code: "1"
     }
  ];
  try {
     console.log("Generating...");
     const path = await createOfflineExcel("株式会社テスト", 2026, dummy);
     console.log("Success:", path);
  } catch(e) {
     console.error(e);
  }
}
main();
