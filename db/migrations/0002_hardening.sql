-- Database-level immutability hardening (P1-C)
-- Memblokir UPDATE/DELETE pada AuditLog dan DELETE pada Report di level PostgreSQL.

CREATE OR REPLACE FUNCTION greenpark_block_auditlog_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog bersifat immutable dan tidak boleh diubah atau dihapus.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditlog_no_update_delete ON "AuditLog";
CREATE TRIGGER trg_auditlog_no_update_delete
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION greenpark_block_auditlog_mutation();

CREATE OR REPLACE FUNCTION greenpark_block_report_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Report tidak boleh dihapus permanen; gunakan arsip (archivedAt).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_no_delete ON "Report";
CREATE TRIGGER trg_report_no_delete
BEFORE DELETE ON "Report"
FOR EACH ROW
EXECUTE FUNCTION greenpark_block_report_delete();
