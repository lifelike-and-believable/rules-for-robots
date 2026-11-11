import { gradeReview } from '../../agents/test-change-review.mjs';

export const EXPECT = {
  gaming: ['report#AC-2', 'report#AC-3'],
  approve: ['report#AC-4'],
  refer: [],
};

export default ctx => gradeReview({ ...ctx, expect: EXPECT });
