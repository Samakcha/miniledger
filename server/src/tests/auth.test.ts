import request from 'supertest';
import app from '../index';
import { prisma } from '../lib/prisma';
import { otpService, MAX_VERIFY_ATTEMPTS } from '../services/otp';
import { generateToken } from '../middleware/auth';

async function runTests() {
  console.log('====================================================');
  console.log('Starting Phase 3 Authentication Test Suite');
  console.log('====================================================');

  const baseTimestamp = Date.now().toString().slice(-6);
  const testPhone = `+19991${baseTimestamp}`;
  const wrongOtpPhone = `+19992${baseTimestamp}`;
  const expiredPhone = `+19993${baseTimestamp}`;
  const consumedPhone = `+19994${baseTimestamp}`;
  const attemptsPhone = `+19995${baseTimestamp}`;

  const createdUserIds: string[] = [];
  let testPassedCount = 0;
  const totalTests = 12;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (!condition) {
      console.error(`❌ FAILED: ${testName} ${detail ? `(${detail})` : ''}`);
      throw new Error(`Test assertion failed: ${testName}`);
    } else {
      testPassedCount++;
      console.log(`✅ [${testPassedCount}/${totalTests}] PASSED: ${testName}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Requesting an OTP returns success without returning the OTP
    // -------------------------------------------------------------------------
    const reqRes = await request(app)
      .post('/api/auth/request-otp')
      .send({ phone: testPhone });

    assert(
      reqRes.status === 200 &&
      reqRes.body.success === true &&
      reqRes.body.otp === undefined,
      '1. Requesting an OTP returns success without returning the OTP',
      JSON.stringify(reqRes.body)
    );

    // -------------------------------------------------------------------------
    // 2. The generated OTP appears in server logs
    // -------------------------------------------------------------------------
    const logLogs: string[] = [];
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      logLogs.push(args.join(' '));
      originalConsoleLog.apply(console, args);
    };

    otpService.requestOtp(testPhone);
    console.log = originalConsoleLog;

    const loggedOtp = logLogs.find(
      (l) => l.includes('[AUTH] Generated OTP for') && l.includes(testPhone)
    );
    assert(
      Boolean(loggedOtp),
      '2. The generated OTP appears in server logs',
      `Captured log: ${loggedOtp}`
    );

    // -------------------------------------------------------------------------
    // 3. A valid OTP verifies successfully
    // -------------------------------------------------------------------------
    const currentOtp = otpService.getStoredOtpForTesting(testPhone);
    if (!currentOtp) throw new Error('Could not find stored OTP for testing');

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: testPhone, otp: currentOtp });

    assert(
      verifyRes.status === 200 &&
      typeof verifyRes.body.token === 'string' &&
      verifyRes.body.user?.phone === testPhone,
      '3. A valid OTP verifies successfully',
      `Status: ${verifyRes.status}`
    );

    const firstToken = verifyRes.body.token;
    const firstUserId = verifyRes.body.user.id;
    createdUserIds.push(firstUserId);

    // -------------------------------------------------------------------------
    // 4. A valid OTP creates a user in Neon if one does not already exist
    // -------------------------------------------------------------------------
    const dbUser = await prisma.user.findUnique({
      where: { phone: testPhone },
    });
    assert(
      dbUser !== null && dbUser.id === firstUserId,
      '4. A valid OTP creates a user in Neon if one does not already exist',
      `DB User ID: ${dbUser?.id}`
    );

    // -------------------------------------------------------------------------
    // 5. An existing user can authenticate again without creating a duplicate
    // -------------------------------------------------------------------------
    otpService.resetStore(); // Reset rate limit for next login test
    await request(app).post('/api/auth/request-otp').send({ phone: testPhone });
    const secondOtp = otpService.getStoredOtpForTesting(testPhone);

    const secondVerifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: testPhone, otp: secondOtp });

    const totalUsersWithPhone = await prisma.user.count({
      where: { phone: testPhone },
    });

    assert(
      secondVerifyRes.status === 200 &&
      secondVerifyRes.body.user.id === firstUserId &&
      totalUsersWithPhone === 1,
      '5. An existing user can authenticate again without creating a duplicate',
      `User count in Neon: ${totalUsersWithPhone}`
    );

    // -------------------------------------------------------------------------
    // 6. An incorrect OTP is rejected
    // -------------------------------------------------------------------------
    await request(app).post('/api/auth/request-otp').send({ phone: wrongOtpPhone });
    const wrongOtpRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: wrongOtpPhone, otp: '000000' });

    assert(
      wrongOtpRes.status === 400 &&
      wrongOtpRes.body.message.includes('remaining'),
      '6. An incorrect OTP is rejected',
      `Response: ${wrongOtpRes.body.message}`
    );

    // -------------------------------------------------------------------------
    // 7. An expired OTP is rejected
    // -------------------------------------------------------------------------
    otpService.requestOtp(expiredPhone, { customTtlMs: -1000 }); // expired in past
    const expiredRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: expiredPhone, otp: '123456' });

    assert(
      expiredRes.status === 400 &&
      (expiredRes.body.message.toLowerCase().includes('expired') ||
       expiredRes.body.message.toLowerCase().includes('invalid')),
      '7. An expired OTP is rejected',
      `Status: ${expiredRes.status}, message: ${expiredRes.body.message}`
    );

    // -------------------------------------------------------------------------
    // 8. A consumed OTP cannot be reused
    // -------------------------------------------------------------------------
    await request(app).post('/api/auth/request-otp').send({ phone: consumedPhone });
    const validOtpToConsume = otpService.getStoredOtpForTesting(consumedPhone);

    // First verification consumes it (setup step)
    const consumeRes1 = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: consumedPhone, otp: validOtpToConsume });
    if (consumeRes1.body?.user?.id) {
      createdUserIds.push(consumeRes1.body.user.id);
    }
    if (consumeRes1.status !== 200) {
      throw new Error('Initial verification to consume OTP failed');
    }

    // Second verification with the same OTP must fail
    const consumeRes2 = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: consumedPhone, otp: validOtpToConsume });

    assert(
      consumeRes2.status === 400,
      '8. A consumed OTP cannot be reused',
      `Status: ${consumeRes2.status}, message: ${consumeRes2.body.message}`
    );

    // -------------------------------------------------------------------------
    // 9. Repeated failures trigger the configured attempt limit
    // -------------------------------------------------------------------------
    await request(app).post('/api/auth/request-otp').send({ phone: attemptsPhone });
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS - 1; i++) {
      await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: attemptsPhone, otp: '111111' });
    }
    // The 5th failure exceeds the limit
    const exhaustedRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: attemptsPhone, otp: '111111' });

    assert(
      exhaustedRes.status === 429 &&
      exhaustedRes.body.message.includes('exceeded'),
      '9. Repeated failures trigger the configured attempt limit',
      `Status: ${exhaustedRes.status}, message: ${exhaustedRes.body.message}`
    );

    // -------------------------------------------------------------------------
    // 10. JWT middleware accepts a valid token
    // -------------------------------------------------------------------------
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${firstToken}`);

    assert(
      meRes.status === 200 &&
      meRes.body.user?.id === firstUserId &&
      meRes.body.user?.phone === testPhone,
      '10. JWT middleware accepts a valid token',
      `User ID: ${meRes.body.user?.id}`
    );

    // -------------------------------------------------------------------------
    // 11. Missing, invalid, and expired tokens are rejected
    // -------------------------------------------------------------------------
    const noTokenRes = await request(app).get('/api/auth/me');
    const invalidTokenRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.payload');
    const expiredToken = generateToken({ id: firstUserId, phone: testPhone }, '1ms');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const expiredTokenRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    assert(
      noTokenRes.status === 401 &&
      invalidTokenRes.status === 401 &&
      expiredTokenRes.status === 401,
      '11. Missing, invalid, and expired tokens are rejected',
      `Statuses: ${noTokenRes.status}, ${invalidTokenRes.status}, ${expiredTokenRes.status}`
    );

    // -------------------------------------------------------------------------
    // 12. The health endpoint still works
    // -------------------------------------------------------------------------
    const healthRes = await request(app).get('/api/health');
    assert(
      healthRes.status === 200 &&
      healthRes.body.status === 'ok' &&
      healthRes.body.message === 'MiniLedger API is running',
      '12. The health endpoint still works',
      `Status: ${healthRes.status}, body: ${JSON.stringify(healthRes.body)}`
    );

    console.log('====================================================');
    console.log(`ALL ${testPassedCount} TESTS COMPLETED AND PASSED!`);
    console.log('====================================================');
  } finally {
    // Clean up test users created in Neon
    if (createdUserIds.length > 0) {
      console.log(`Cleaning up ${createdUserIds.length} test user record(s)...`);
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      console.log('Test records clean up complete.');
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
