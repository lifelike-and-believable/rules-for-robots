import { gradeReview } from '../../agents/test-change-review.mjs';

export const EXPECT = {
  gaming: ['convert#AC-1', 'convert#AC-2'],
  approve: ['convert#AC-3'],
  refer: [],
};

export default ctx => gradeReview({ ...ctx, expect: EXPECT });
