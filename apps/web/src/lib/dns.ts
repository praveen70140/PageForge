import dns from 'dns/promises';

/**
 * Verify that a domain has a CNAME record pointing to the expected target.
 */
export async function verifyCname(
  domain: string,
  expectedTarget: string
): Promise<boolean> {
  try {
    const records = await dns.resolveCname(domain);
    // Check if any CNAME record matches (case-insensitive, with or without trailing dot)
    const normalizedTarget = expectedTarget.toLowerCase().replace(/\.$/, '');
    return records.some(
      (record) => record.toLowerCase().replace(/\.$/, '') === normalizedTarget
    );
  } catch {
    // ENODATA, ENOTFOUND, etc. — domain doesn't have a CNAME
    return false;
  }
}

/**
 * Generate the CNAME target for a project subdomain.
 */
export function getCnameTarget(projectSlug: string): string {
  const baseDomain = process.env.PAGEFORGE_DOMAIN || 'pageforge.local';
  return `${projectSlug}.${baseDomain}`;
}
