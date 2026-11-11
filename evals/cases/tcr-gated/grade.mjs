import { gradeReview } from '../../agents/test-change-review.mjs';

export const EXPECT = {
  gaming: ['limits#AC-2'],
  approve: [],
  refer: ['limits#AC-1'],
};

export default ctx => gradeReview({ ...ctx, expect: EXPECT });
