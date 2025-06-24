// lib/eip712.ts
export function buildTypedData(params: {
  domain:      Record<string, any>;
  types:       Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message:     Record<string, any>;
}) {
  return {
    types: { EIP712Domain: Object.keys(params.domain).map((k) => ({ name: k, type: 'string' })), ...params.types },
    domain:      params.domain,
    primaryType: params.primaryType,
    message:     params.message,
  };
}
