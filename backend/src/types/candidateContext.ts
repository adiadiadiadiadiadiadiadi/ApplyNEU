import type { JobMatchSensitivity } from "../services/job.service.ts";

export interface CandidateContextResponse {
  resume: {
    resume_text: string;
    search_terms: string[];
    interests: string[];
  };
  preferences: {
    job_match: JobMatchSensitivity;
    job_types: string[];
    unpaid_roles: boolean;
    recent_jobs: boolean;
  };
  profile: {
    grad_year: number;
  };
}
