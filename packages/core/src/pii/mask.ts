/**
 * PII マスキング関数群
 * PII masking functions
 * Fungsi masking PII
 *
 * ログ・レスポンス・エラーメッセージ等、平文として出力してはいけない場面で
 * 値を不可逆な表示形に変換する。設計原則: 何をマスクしたかは分かるが、
 * 元の値は復元できないこと。
 * Convert values to an irreversible display form wherever plaintext must
 * not leak (logs, responses, error messages). Design principle: the kind
 * of PII should remain recognizable but the original value must not be
 * recoverable from the masked form.
 */
import type { PiiKind } from "./types.js";

/**
 * 氏名のマスキング: "田中太郎" -> "田*太*"、"GILANG PERMANA" -> "G****** P*****"
 * Name masking preserving first character of each token.
 * Masking nama yang mempertahankan karakter pertama setiap token.
 */
export function maskName(value: string): string {
  if (!value) return "";
  const tokens = value.trim().split(/\s+|　+/);
  return tokens
    .map((token) => {
      const chars = Array.from(token);
      if (chars.length === 0) return "";
      if (chars.length === 1) return chars[0] + "*";
      return chars[0] + "*".repeat(chars.length - 1);
    })
    .join(" ");
}

/**
 * 在留カード番号のマスキング: "AB12345678CD" -> "AB**********"
 * Residence card number masking, keeping first 2 chars.
 * Masking nomor kartu residensi, mempertahankan 2 karakter pertama.
 */
export function maskResidenceCard(value: string): string {
  if (!value) return "";
  const cleaned = value.replace(/\s/g, "");
  if (cleaned.length <= 2) return "*".repeat(cleaned.length);
  return cleaned.slice(0, 2) + "*".repeat(cleaned.length - 2);
}

/**
 * パスポート番号のマスキング: "TK1234567" -> "TK*******"
 * Passport number masking, keeping first 2 chars.
 * Masking nomor paspor, mempertahankan 2 karakter pertama.
 */
export function maskPassport(value: string): string {
  if (!value) return "";
  const cleaned = value.replace(/\s/g, "");
  if (cleaned.length <= 2) return "*".repeat(cleaned.length);
  return cleaned.slice(0, 2) + "*".repeat(cleaned.length - 2);
}

/**
 * 生年月日のマスキング: "1995-03-15" -> "1995-**-**"
 * Date of birth masking, keeping year only.
 * Masking tanggal lahir, hanya mempertahankan tahun.
 */
export function maskDob(value: string): string {
  if (!value) return "";
  const isoMatch = value.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (isoMatch) return `${isoMatch[1]}-**-**`;
  const slashMatch = value.match(/^(\d{4})\/\d{2}\/\d{2}$/);
  if (slashMatch) return `${slashMatch[1]}/**/**`;
  return "****-**-**";
}

/**
 * 住所のマスキング: 都道府県＋市区町村のみ残す
 * Address masking preserving prefecture and city only.
 * Masking alamat hanya mempertahankan prefektur dan kota.
 */
export function maskAddress(value: string): string {
  if (!value) return "";
  const match = value.match(
    /^(.+?[都道府県])(.+?[市区町村郡])/u,
  );
  if (match) {
    return `${match[1]}${match[2]}****`;
  }
  const prefOnly = value.match(/^(.+?[都道府県])/u);
  if (prefOnly) {
    return `${prefOnly[1]}****`;
  }
  if (value.length <= 3) return "*".repeat(value.length);
  return value.slice(0, 3) + "*".repeat(Math.max(value.length - 3, 1));
}

/**
 * 電話番号のマスキング: "090-1234-5678" -> "090-****-5678"
 * Phone number masking preserving area code and last 4 digits.
 * Masking nomor telepon mempertahankan kode area dan 4 digit terakhir.
 */
export function maskPhone(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "*".repeat(digits.length);
  if (digits.length <= 7) return digits.slice(0, 3) + "*".repeat(digits.length - 3);
  const area = digits.slice(0, 3);
  const last = digits.slice(-4);
  const middleLen = digits.length - 3 - 4;
  return `${area}-${"*".repeat(middleLen)}-${last}`;
}

/**
 * メールアドレスのマスキング: "taro.tanaka@example.com" -> "t**********@example.com"
 * Email masking preserving first char of local part and full domain.
 * Masking email mempertahankan karakter pertama local part dan domain.
 */
export function maskEmail(value: string): string {
  if (!value) return "";
  const at = value.lastIndexOf("@");
  if (at <= 0) return "*".repeat(value.length);
  const local = value.slice(0, at);
  const domain = value.slice(at);
  if (local.length === 1) return local + domain;
  return local[0] + "*".repeat(local.length - 1) + domain;
}

/**
 * 法人番号のマスキング: "1234567890123" -> "1234*********"
 * Corporate number masking, keeping first 4 digits.
 * Masking nomor perusahaan, mempertahankan 4 digit pertama.
 */
export function maskCorporateId(value: string): string {
  if (!value) return "";
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 4) return "*".repeat(cleaned.length);
  return cleaned.slice(0, 4) + "*".repeat(cleaned.length - 4);
}

/**
 * マイナンバーのマスキング: 全桁マスク（最も厳格）
 * My Number masking — most strict: every digit is hidden.
 * Masking My Number paling ketat: semua digit disembunyikan.
 */
export function maskMyNumber(value: string): string {
  if (!value) return "";
  const cleaned = value.replace(/\D/g, "");
  return "*".repeat(cleaned.length);
}

/**
 * 銀行口座番号のマスキング: 末尾4桁のみ残す
 * Bank account masking keeping last 4 digits only.
 * Masking rekening bank hanya mempertahankan 4 digit terakhir.
 */
export function maskBankAccount(value: string): string {
  if (!value) return "";
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 4) return "*".repeat(cleaned.length);
  return "*".repeat(cleaned.length - 4) + cleaned.slice(-4);
}

/**
 * 汎用: 半分だけ隠す
 * Generic: hide second half of the value.
 * Umum: sembunyikan separuh terakhir nilai.
 */
export function maskGeneric(value: string): string {
  if (!value) return "";
  const half = Math.ceil(value.length / 2);
  return value.slice(0, value.length - half) + "*".repeat(half);
}

/**
 * PiiKind → マスキング関数のディスパッチ
 * Dispatch from PiiKind to the appropriate masking function.
 * Dispatch dari PiiKind ke fungsi masking yang sesuai.
 */
export function maskByKind(kind: PiiKind, value: string): string {
  switch (kind) {
    case "name":
    case "name_kana":
      return maskName(value);
    case "residence_card":
      return maskResidenceCard(value);
    case "passport":
      return maskPassport(value);
    case "dob":
      return maskDob(value);
    case "address":
      return maskAddress(value);
    case "phone":
      return maskPhone(value);
    case "email":
      return maskEmail(value);
    case "corporate_id":
      return maskCorporateId(value);
    case "my_number":
      return maskMyNumber(value);
    case "bank_account":
      return maskBankAccount(value);
    case "generic":
    default:
      return maskGeneric(value);
  }
}
