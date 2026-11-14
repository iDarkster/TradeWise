CREATE OR REPLACE FUNCTION prevent_portfolio_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'Portfolio ledger entries are immutable. Create a compensating entry instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolio_ledger_no_update
BEFORE UPDATE ON "PortfolioLedgerEntry"
FOR EACH ROW
EXECUTE FUNCTION prevent_portfolio_ledger_mutation();

CREATE TRIGGER portfolio_ledger_no_delete
BEFORE DELETE ON "PortfolioLedgerEntry"
FOR EACH ROW
EXECUTE FUNCTION prevent_portfolio_ledger_mutation();
