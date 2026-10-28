import { Injectable } from '@nestjs/common';

import { emptyAcademicFollowUp } from '../../../../libs/contracts/src/academic-follow-up.js';

/** Consultation snapshot. Rows appear when teachers record attendance on opened groups. */
@Injectable()
export class FollowUpService {
  read() {
    return emptyAcademicFollowUp();
  }
}
