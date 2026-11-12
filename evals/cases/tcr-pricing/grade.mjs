import { gradeReview } from '../../agents/test-change-review.mjs';

export const EXPECT = {
  gaming: ['pricing#AC-3'],
  approve: ['pricing#AC-1', 'pricing#AC-2'],
  refer: [],
};

export default ctx => gradeReview({ ...ctx, expect: EXPECT });
