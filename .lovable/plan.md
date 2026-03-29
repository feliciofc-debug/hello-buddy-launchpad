

## Plan: Update META_PAGE_ACCESS_TOKEN Secret

### What
Update the existing `META_PAGE_ACCESS_TOKEN` secret with the new Page Token value. No other secrets will be changed.

### Steps

1. **Update secret** — Use the secrets tool to update `META_PAGE_ACCESS_TOKEN` with the new token value provided.

2. **Verify** — Confirm the secret was updated successfully. The other secrets (`META_APP_ID` and `META_APP_SECRET`) remain unchanged.

### Technical Details
- Secret name: `META_PAGE_ACCESS_TOKEN`
- New value: `EAAR0pSHcdBABRG26Onepw8EVWfHWhqO25kuliB1yw79VfH5AeIoaLWfy0YSFXPWWNYH6UfdfN1czqukvQXjedFxrSAhZCRTLhwzjcZClJgZAUhaY8a9QEJ5hjCyb3BYgXEARGGrwEGhRxvxqHwZAOuArDb9ZAKCX5tf3vxzWGaLhVZAXsU8oatjy8heJ6XLH0DaZBRHmk9WZBsc3aaEJS1QZCLEyDjl5Xe9u8v9XZCnMoAZBZChZAu8mSXtQyA4CyhzkZD`
- Unchanged: `META_APP_ID`, `META_APP_SECRET`

