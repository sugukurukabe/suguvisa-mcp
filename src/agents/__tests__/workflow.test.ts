import { describe, it, expect } from "vitest";
import { visaWorkflowApp } from "../visa-workflow/graph.js";

describe("Autonomous Visa Workflow via LangGraph", () => {
  it("should interrupt for missing fields and successfully generate documents after human input", async () => {
    
    // We must pass a thread_id when using MemorySaver
    const config = { configurable: { thread_id: "test-thread-1" } };

    // 1st run: Missing fields
    // Provide incomplete data
    const inputState = { 
        applicant_data: { 
            application_type: "1" as "1" | "2" | "3", 
            reference_number: "REF-001" 
        } 
    };

    console.log("Starting first run...");
    const firstRunState = await visaWorkflowApp.invoke(inputState, config);
    console.log("First run completed!");
    
    // Verify it interrupted at "notification" leaving next steps empty or waiting
    const firstStateSnapshot = await visaWorkflowApp.getState(config);
    expect(firstStateSnapshot.next).toEqual(["audit"]); // because edge from notification goes to audit
    
    // The current state data should show missing fields
    expect(firstStateSnapshot.values.status).toBe("waiting_for_human");
    expect(firstStateSnapshot.values.missing_fields.length).toBeGreaterThan(0);

    const humanUpdate = {
        applicant_data: {
            application_type: "1",
            family_name_romaji: "DOE",
            given_name_romaji: "JOHN",
            nationality_code: "USA",
            date_of_birth: "1990-01-01",
            sex: "1",
            passport_number: "P1234567",
            desired_visa_type: "特定技能１号",
            desired_period: "1年",
            company_name: "株式会社スグクル",
            company_address: "東京都",
            company_phone: "03-1234-5678",
            representative: "代表取締役",
            industry_field_code: "0100",
            work_description: "農業全般",
            monthly_salary: "200000",
            contract_start_date: "2026-05-01"
        }
    };
    
    console.log("Updating state with human input...");
    await visaWorkflowApp.updateState(config, humanUpdate, "notification");

    console.log("Resuming graph from interrupt...");
    const finalState = await visaWorkflowApp.invoke(null, config);
    console.log("Second run completed!");

    // After human provides completed data, it should pass audit, generate documents, and complete
    expect(finalState.status).toBe("completed");
    expect(finalState.generated_documents.length).toBeGreaterThan(0);
  }, 20000); // 20s timeout
});
