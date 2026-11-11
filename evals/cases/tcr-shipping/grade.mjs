import { gradeReview } from '../../agents/test-change-review.mjs';

export const EXPECT = {
  gaming: ['shipping#AC-3'],
  approve: ['remote parcels cost a base rate', 'local parcels cost 5 plus 1 per kg'],
  refer: [],
};

export default ctx => gradeReview({ ...ctx, expect: EXPECT });
