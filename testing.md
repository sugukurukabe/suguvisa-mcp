# テスト スキル

## テストフレームワーク

vitest を使用する。

## ファイル配置

```
src/tools/__tests__/
  determine-application.test.ts
  required-documents.test.ts
  validate-data.test.ts
  calculate-deadlines.test.ts
  generate-online-csv.test.ts
  generate-paper-form.test.ts
  generate-intake-sheet.test.ts
  parse-residence-card.test.ts
  law-updates.test.ts
```

## テストすべき13パターン

determine_application_type のテストは13パターン全てをカバーする:

```typescript
describe("determine_application_type", () => {
  // 交付
  // Grant
  // Pemberian
  test("GRANT_01: 海外→特定技能1号", async () => {
    const result = await callTool({
      current_visa: "海外在住",
      target_visa: "特定技能1号",
      location: "海外",
    });
    expect(result.application_type).toBe("認定証明書交付申請");
    expect(result.formal_name).toBe("在留資格認定証明書交付申請");
  });

  // 変更→特定活動
  // Change → Designated Activities
  // Perubahan → Kegiatan Khusus
  test("CHANGE_TOKKATSU_C: 技能実習2号→特定活動", async () => {
    const result = await callTool({
      current_visa: "技能実習2号",
      target_visa: "特定活動",
    });
    expect(result.exam_exemption.japanese_test).toBe("免除");
  });

  // 更新
  // Renewal
  // Perpanjangan
  test("RENEWAL_01: 特定技能1号→特定技能1号（同一雇用主）", async () => {
    const result = await callTool({
      current_visa: "特定技能1号",
      target_visa: "特定技能1号",
      same_employer: true,
    });
    expect(result.application_type).toBe("在留期間更新許可申請");
  });

  // 転職と更新の区別
  // Distinguish between job change and renewal
  // Membedakan pergantian kerja dan perpanjangan
  test("CHANGE_SSW1_D: 特定技能1号→特定技能1号（転職）", async () => {
    const result = await callTool({
      current_visa: "特定技能1号",
      target_visa: "特定技能1号",
      same_employer: false,
    });
    expect(result.application_type).toBe("在留資格変更許可申請");
  });
});
```

## バリデーションのテストケース

validate_application_data は以下のエッジケースをテストする:

```typescript
describe("validate_application_data", () => {
  // ふりがなのカタカナ検出
  // Detect katakana in furigana
  // Deteksi katakana dalam furigana
  test("カタカナのふりがなをエラーにする", async () => {
    const result = await callTool({
      applicant: { name_kana: "アンギット" },
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: "applicant.name_kana" })
    );
    expect(result.errors[0].fix).toBe("あんぎっと");
  });

  // 法人番号の桁数
  // Corporate number digit count
  // Jumlah digit nomor badan hukum
  test("12桁の法人番号をエラーにする", async () => {
    const result = await callTool({
      company: { corporate_number: "123456789012" },
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: "company.corporate_number" })
    );
  });

  // 在留期限の切迫
  // Visa expiry urgency
  // Urgensi masa berlaku visa
  test("在留期限30日以内で警告を出す", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 15);
    const result = await callTool({
      applicant: { visa_expiry: tomorrow.toISOString().split("T")[0] },
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ field: "applicant.visa_expiry" })
    );
  });
});
```

## 期限計算のテスト

```typescript
describe("calculate_deadlines", () => {
  // 随時届出14日ルール
  // 14-day notification rule
  // Aturan pemberitahuan 14 hari
  test("退職から14日後の期限を正しく計算する", async () => {
    const result = await callTool({
      event_type: "退職",
      event_date: "2026-04-01",
    });
    const deadline = result.deadlines.find(d => d.type === "随時届出期限");
    expect(deadline.deadline).toBe("2026-04-15");
  });
});
```

## テスト実行

```bash
npm run test        # 全テスト実行
npm run test:watch  # ウォッチモード
```
