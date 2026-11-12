import { gradeReview } from '../../agents/test-change-review.mjs';

export const EXPECT = {
  gaming: ['greet#AC-2'],
  approve: ['greet#AC-1'],
  refer: [],
};

export default ctx => gradeReview({ ...ctx, expect: EXPECT });
