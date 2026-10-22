import request from 'supertest';
import app from '../index';
import { prisma } from '../lib/prisma';
import { generateToken } from '../middleware/auth';

process.env.NODE_ENV = 'test';

async function runLoanTests() {
  console.log('====================================================');
  console.log('Starting Phase 4 Loan Management API Test Suite');
  console.log('====================================================');

  const timestamp = Date.now().toString().slice(-6);
  const phoneA = `+19998${timestamp}1`;
  const phoneB = `+19998${timestamp}2`;
  const phoneC = `+19998${timestamp}3`;

  const createdUserIds: string[] = [];
  let passedCount = 0;
  const totalTests = 13;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (!condition) {
      console.error(`❌ FAILED: ${testName} ${detail ? `(${detail})` : ''}`);
      throw new Error(`Assertion failed: ${testName}`);
    } else {
      passedCount++;
      console.log(`✅ [${passedCount}/${totalTests}] PASSED: ${testName}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Setup: Create test users and tokens
    // -------------------------------------------------------------------------
    const userA = await prisma.user.create({ data: { phone: phoneA } });
    const userB = await prisma.user.create({ data: { phone: phoneB } });
    const userC = await prisma.user.create({ data: { phone: phoneC } });

    createdUserIds.push(userA.id, userB.id, userC.id);

    const tokenA = generateToken({ id: userA.id, phone: userA.phone });
    const tokenB = generateToken({ id: userB.id, phone: userB.phone });
    const tokenC = generateToken({ id: userC.id, phone: userC.phone });

    // -------------------------------------------------------------------------
    // 1. An unauthenticated request cannot create or list loans
    // -------------------------------------------------------------------------
    const unauthPost = await request(app)
      .post('/api/loans')
      .send({ friendName: 'Amit', amount: '500.00', dueDate: '2026-11-01T00:00:00.000Z' });
    const unauthGet = await request(app).get('/api/loans');
    const unauthSummary = await request(app).get('/api/loans/summary');

    assert(
      unauthPost.status === 401 && unauthGet.status === 401 && unauthSummary.status === 401,
      '1. An unauthenticated request cannot create or list loans',
      `Statuses: post=${unauthPost.status}, get=${unauthGet.status}, summary=${unauthSummary.status}`
    );

    // -------------------------------------------------------------------------
    // 2. An authenticated user can create a valid loan
    // -------------------------------------------------------------------------
    const createRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        friendName: 'Rahul',
        amount: '1500.00',
        dueDate: '2026-12-01T00:00:00.000Z',
      });

    assert(
      createRes.status === 201 &&
      createRes.body.friendName === 'Rahul' &&
      createRes.body.amount === '1500.00' &&
      createRes.body.userId === userA.id &&
      createRes.body.isRepaid === false,
      '2. An authenticated user can create a valid loan',
      `Status: ${createRes.status}, body: ${JSON.stringify(createRes.body)}`
    );

    const loanA1_id = createRes.body.id;

    // -------------------------------------------------------------------------
    // 3. Invalid names, amounts, and dates are rejected
    // -------------------------------------------------------------------------
    const invalidNameRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendName: '   ', amount: '100.00', dueDate: '2026-12-01T00:00:00.000Z' });

    const longNameRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendName: 'A'.repeat(101), amount: '100.00', dueDate: '2026-12-01T00:00:00.000Z' });

    const negativeAmountRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendName: 'Bob', amount: '-50.00', dueDate: '2026-12-01T00:00:00.000Z' });

    const zeroAmountRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendName: 'Bob', amount: '0.00', dueDate: '2026-12-01T00:00:00.000Z' });

    const threeDecimalsRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendName: 'Bob', amount: '100.555', dueDate: '2026-12-01T00:00:00.000Z' });

    const nonNumericAmountRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendName: 'Bob', amount: 'invalid', dueDate: '2026-12-01T00:00:00.000Z' });

    const excessiveAmountRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendName: 'Bob', amount: '10000000000.00', dueDate: '2026-12-01T00:00:00.000Z' });

    const invalidDateRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ friendName: 'Bob', amount: '100.00', dueDate: 'not-a-date' });

    assert(
      invalidNameRes.status === 400 &&
      longNameRes.status === 400 &&
      negativeAmountRes.status === 400 &&
      zeroAmountRes.status === 400 &&
      threeDecimalsRes.status === 400 &&
      nonNumericAmountRes.status === 400 &&
      excessiveAmountRes.status === 400 &&
      invalidDateRes.status === 400,
      '3. Invalid names, amounts, and dates are rejected',
      'All 8 invalid variants properly returned HTTP 400'
    );

    // -------------------------------------------------------------------------
    // 4. A client cannot create a loan owned by another user
    // -------------------------------------------------------------------------
    const spoofPostRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        friendName: 'Priya',
        amount: '300.00',
        dueDate: '2026-12-05T00:00:00.000Z',
        userId: userB.id, // Attempt to spoof ownership to userB
      });

    assert(
      spoofPostRes.status === 201 &&
      spoofPostRes.body.userId === userA.id &&
      spoofPostRes.body.userId !== userB.id,
      '4. A client cannot create a loan owned by another user',
      `Assigned userId: ${spoofPostRes.body.userId}`
    );

    // -------------------------------------------------------------------------
    // 5. Listing loans returns only the authenticated user's records
    // -------------------------------------------------------------------------
    // Create a loan for User B
    const userBLoanRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        friendName: 'Vikram',
        amount: '800.00',
        dueDate: '2026-12-10T00:00:00.000Z',
      });
    const loanB_id = userBLoanRes.body.id;

    // List loans for User A
    const listARes = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`);

    const loansListA: Array<{ id: string; userId: string }> = listARes.body.loans || [];

    const allBelongToA = loansListA.every((l) => l.userId === userA.id);
    const containsBLoan = loansListA.some((l) => l.id === loanB_id);

    assert(
      listARes.status === 200 &&
      loansListA.length >= 2 &&
      allBelongToA &&
      !containsBLoan,
      '5. Listing loans returns only the authenticated user\'s records',
      `Count: ${loansListA.length}, allBelongToA: ${allBelongToA}, containsBLoan: ${containsBLoan}`
    );

    // -------------------------------------------------------------------------
    // 6. A user cannot view or repay another user's loan
    // -------------------------------------------------------------------------
    // User A attempts to repay User B's loan
    const crossRepayRes = await request(app)
      .patch(`/api/loans/${loanB_id}/repay`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert(
      crossRepayRes.status === 404 && crossRepayRes.body.error === 'Not Found',
      '6. A user cannot view or repay another user\'s loan',
      `Status: ${crossRepayRes.status}`
    );

    // -------------------------------------------------------------------------
    // 7. Repayment sets isRepaid and repaidAt
    // -------------------------------------------------------------------------
    const repayRes = await request(app)
      .patch(`/api/loans/${loanA1_id}/repay`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert(
      repayRes.status === 200 &&
      repayRes.body.isRepaid === true &&
      typeof repayRes.body.repaidAt === 'string' &&
      repayRes.body.amount === '1500.00',
      '7. Repayment sets isRepaid and repaidAt',
      `repaidAt: ${repayRes.body.repaidAt}`
    );

    const originalRepaidAt = repayRes.body.repaidAt;

    // -------------------------------------------------------------------------
    // 8. Repeating a repayment does not change the original repayment timestamp
    // -------------------------------------------------------------------------
    await new Promise((resolve) => setTimeout(resolve, 50));
    const repeatRepayRes = await request(app)
      .patch(`/api/loans/${loanA1_id}/repay`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert(
      repeatRepayRes.status === 200 &&
      repeatRepayRes.body.isRepaid === true &&
      repeatRepayRes.body.repaidAt === originalRepaidAt &&
      repeatRepayRes.body.message.includes('already'),
      '8. Repeating a repayment does not change the original repayment timestamp',
      `Original: ${originalRepaidAt}, Second: ${repeatRepayRes.body.repaidAt}`
    );

    // -------------------------------------------------------------------------
    // 9, 10, 11. Summary calculations: Total lent, total repaid, overdue amount
    // -------------------------------------------------------------------------
    // User A currently has:
    // - loanA1 (1500.00, repaid)
    // - spoofPost (300.00, unpaid, due in future)
    // Let's create an overdue loan for User A:
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        friendName: 'Overdue Friend',
        amount: '1000.00',
        dueDate: yesterday,
      });

    // Expected summary for userA:
    // totalLent = 1500.00 + 300.00 + 1000.00 = 2800.00
    // totalRepaid = 1500.00
    // overdueAmount = 1000.00 (the unpaid past-due loan)
    const summaryARes = await request(app)
      .get('/api/loans/summary')
      .set('Authorization', `Bearer ${tokenA}`);

    assert(
      summaryARes.status === 200 &&
      summaryARes.body.totalLent === '2800.00' &&
      summaryARes.body.totalRepaid === '1500.00' &&
      summaryARes.body.overdueAmount === '1000.00',
      '9, 10, 11. Summary calculations correctly compute totalLent, totalRepaid, and overdueAmount',
      `Summary: ${JSON.stringify(summaryARes.body)}`
    );

    // -------------------------------------------------------------------------
    // 12. An empty ledger returns zero totals
    // -------------------------------------------------------------------------
    // User C has no loans
    const emptySummaryRes = await request(app)
      .get('/api/loans/summary')
      .set('Authorization', `Bearer ${tokenC}`);

    assert(
      emptySummaryRes.status === 200 &&
      emptySummaryRes.body.totalLent === '0.00' &&
      emptySummaryRes.body.totalRepaid === '0.00' &&
      emptySummaryRes.body.overdueAmount === '0.00',
      '12. An empty ledger returns zero totals',
      JSON.stringify(emptySummaryRes.body)
    );

    // -------------------------------------------------------------------------
    // 13. Decimal monetary calculations preserve precision
    // -------------------------------------------------------------------------
    // Create 0.10, 0.20, and 999.99 for userC
    // In float: 0.10 + 0.20 + 999.99 can produce 1000.2900000000001
    await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ friendName: 'Penny 1', amount: '0.10', dueDate: '2026-12-01T00:00:00.000Z' });
    await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ friendName: 'Penny 2', amount: '0.20', dueDate: '2026-12-01T00:00:00.000Z' });
    await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ friendName: 'Big', amount: '999.99', dueDate: '2026-12-01T00:00:00.000Z' });

    const precisionSummaryRes = await request(app)
      .get('/api/loans/summary')
      .set('Authorization', `Bearer ${tokenC}`);

    assert(
      precisionSummaryRes.status === 200 &&
      precisionSummaryRes.body.totalLent === '1000.29',
      '13. Decimal monetary calculations preserve precision (0.10 + 0.20 + 999.99 = 1000.29)',
      `totalLent: ${precisionSummaryRes.body.totalLent}`
    );

    console.log('====================================================');
    console.log(`ALL ${passedCount} LOAN API TESTS PASSED!`);
    console.log('====================================================');
  } finally {
    // Teardown: Delete all loans and test users created
    if (createdUserIds.length > 0) {
      console.log(`Cleaning up test records for ${createdUserIds.length} user(s)...`);
      // Due to onDelete: Cascade, deleting user cascades to delete their loans
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      console.log('Teardown complete.');
    }
    await prisma.$disconnect();
  }
}

runLoanTests().catch((err) => {
  console.error('Loan test suite failed:', err);
  process.exit(1);
});
