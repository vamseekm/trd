import Ajv from 'ajv';
export function newValidator() {
    const ajv = new Ajv({ allErrors: true });
    require('ajv-keywords')(ajv);
    return ajv;
}
