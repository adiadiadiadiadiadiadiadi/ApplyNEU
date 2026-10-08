/**
 * Stored on every instruction_extractions row; a row extracted under a different version is
 * ignored. Bump it when a change to EXTRACTION_RULES or the model should re-extract postings.
 */
export const EXTRACTION_VERSION = 1;

export const INSTRUCTION_KINDS = ['external_application', 'cover_letter', 'other'] as const;

export const INSTRUCTION_LIST_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: [...INSTRUCTION_KINDS] },
      instruction: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['kind', 'instruction', 'description'],
    additionalProperties: false,
  },
};

/**
 * Required application steps, extracted from the posting alongside the score. Last in the
 * job match system block, so leaving it out gives the scoring-only variant.
 */
export const EXTRACTION_RULES = `
EMPLOYER INSTRUCTIONS:
Also extract the steps the posting says are REQUIRED to complete the application,
especially actions outside NUWorks. Include only explicit must-do actions.
Always include the COMPANY name in the instruction text.

NEVER include:
- Resume / transcript / portfolio / references upload instructions
- Optional cover letters (a REQUIRED cover letter is the one upload to include)
- Generic advice (research company, tailor resume, follow up, networking, etc.)
- Optional/preferred/recommended tips
- Browser/device troubleshooting or settings steps
  (ad blocker/pop-up blocker, clear cache/cookies, switch browsers, disable extensions,
   incognito/private mode, VPN/proxy, firewall/antivirus, javascript settings)

ONLY include required actions such as:
- Apply through a separate company portal/site
- Complete a required external assessment or questionnaire
- Email required information/materials to a specific address
- Register/schedule/confirm a required step on another platform
- Submit a required cover letter

If nothing is required beyond the NUWorks form, return an empty array.

FIELDS:
- "kind": "external_application" when the step is applying on a separate company portal/site,
  "cover_letter" when a cover letter is required, "other" for everything else
- "instruction": brief imperative action, e.g. "Apply through Garmin careers portal"
- "description": the exact URL, email or platform when given; otherwise the concise required
  details from the posting
- Make sure the instruction matches the link's owner (e.g. https://ats.rippling.com/tive-careers
  is for Tive, not Rippling).
`.trim();
