// @ts-nocheck
// Mock file for bcryptjs - jest types are not available in this context
export const hash = jest.fn().mockResolvedValue('hashed-password');
export const compare = jest.fn().mockResolvedValue(true);
export default { 
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
};
