import Ajv from 'ajv';
export function newValidator(): Ajv.Ajv {
    const ajv = new Ajv({ allErrors: true, $data: true });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('ajv-keywords')(ajv);
    return ajv;
}
