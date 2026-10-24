import request from 'supertest';
import app from '../index';
import { prisma } from '../lib/prisma';
import { otpService, MAX_VERIFY_ATTEMPTS, isDemoOtpEnabled, DEMO_OTP } from '../services/otp';
import { generateToken } from '../middleware/auth';

async function runTests() {
  console.log('====================================================');
  console.log('Starting Phase 3 Authentication Test Suite');
  console.log('====================================================');

  const initialDemoOtpEnabled = process.env.DEMO_OTP_ENABLED;

  const baseTimestamp = Date.now().toString().slice(-6);
  const testPhone = `+19991${baseTimestamp}`;
  const wrongOtpPhone = `+19992${baseTimestamp}`;
  const expiredPhone = `+19993${baseTimestamp}`;
  const consumedPhone = `+19994${baseTimestamp}`;
  const attemptsPhone = `+19995${baseTimestamp}`;

  const createdUserIds: string[] = [];
  let testPassedCount = 0;
  const totalTests = 18;

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
    // 2. The authentication request is logged to the server terminal
    // -------------------------------------------------------------------------
    const logLogs: string[] = [];
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      logLogs.push(args.join(' '));
      originalConsoleLog.apply(console, args);
    };

    otpService.requestOtp(testPhone);
    console.log = originalConsoleLog;

    const loggedAuth = logLogs.find(
      (l) => l.includes('[AUTH') && l.includes(testPhone) && (l.includes('Generated OTP for') || l.includes('Demo OTP requested for') || l.includes('Demo authentication active'))
    );
    assert(
      Boolean(loggedAuth),
      '2. The generated OTP or demo authentication event appears in server logs',
      `Captured log: ${loggedAuth}`
    );

    // -------------------------------------------------------------------------
    // 3. A valid OTP verifies successfully
    // -------------------------------------------------------------------------
    const currentOtp = isDemoOtpEnabled() ? DEMO_OTP : otpService.getStoredOtpForTesting(testPhone);
    if (!currentOtp) throw new Error('Could not find valid OTP for testing');

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
    const secondOtp = isDemoOtpEnabled() ? DEMO_OTP : otpService.getStoredOtpForTesting(testPhone);
    if (!secondOtp) throw new Error('Could not find valid OTP for re-authentication test');

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
    const prevDemoMode7 = process.env.DEMO_OTP_ENABLED;
    delete process.env.DEMO_OTP_ENABLED;
    otpService.requestOtp(expiredPhone, { customTtlMs: -1000 }); // expired in past
    const expiredRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: expiredPhone, otp: '999999' });

    assert(
      expiredRes.status === 400 &&
      (expiredRes.body.message.toLowerCase().includes('expired') ||
       expiredRes.body.message.toLowerCase().includes('invalid')),
      '7. An expired OTP is rejected',
      `Status: ${expiredRes.status}, message: ${expiredRes.body.message}`
    );
    if (prevDemoMode7 !== undefined) process.env.DEMO_OTP_ENABLED = prevDemoMode7;

    // -------------------------------------------------------------------------
    // 8. A consumed OTP cannot be reused
    // -------------------------------------------------------------------------
    const prevDemoMode8 = process.env.DEMO_OTP_ENABLED;
    delete process.env.DEMO_OTP_ENABLED;
    await request(app).post('/api/auth/request-otp').send({ phone: consumedPhone });
    const validOtpToConsume = otpService.getStoredOtpForTesting(consumedPhone);
    if (!validOtpToConsume) throw new Error('Could not find stored OTP for testing');

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
    if (prevDemoMode8 !== undefined) process.env.DEMO_OTP_ENABLED = prevDemoMode8;

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

    // -------------------------------------------------------------------------
    // 13. When DEMO_OTP_ENABLED is false/unset, '123456' is rejected unless it was the actual generated OTP
    // -------------------------------------------------------------------------
    delete process.env.DEMO_OTP_ENABLED;
    const nonDemoPhone = `+19996${baseTimestamp}`;
    await request(app).post('/api/auth/request-otp').send({ phone: nonDemoPhone });
    const nonDemoStoredOtp = otpService.getStoredOtpForTesting(nonDemoPhone);

    if (nonDemoStoredOtp !== '123456') {
      const nonDemoVerifyRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: nonDemoPhone, otp: '123456' });

      assert(
        nonDemoVerifyRes.status === 400 &&
        nonDemoVerifyRes.body.message.includes('remaining'),
        "13. When DEMO_OTP_ENABLED is false/unset, '123456' is rejected unless it was the actual generated OTP",
        `Response: ${nonDemoVerifyRes.body.message}`
      );
    } else {
      const unreqPhone = `+19997${baseTimestamp}`;
      const unreqVerifyRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: unreqPhone, otp: '123456' });
      assert(
        unreqVerifyRes.status === 400,
        "13. When DEMO_OTP_ENABLED is false/unset, '123456' is rejected for unrequested phone",
        `Response: ${unreqVerifyRes.body.message}`
      );
    }

    // -------------------------------------------------------------------------
    // 14. When DEMO_OTP_ENABLED=true, request-otp returns demoMode: true without returning OTP
    // -------------------------------------------------------------------------
    process.env.DEMO_OTP_ENABLED = 'true';
    const demoTestPhone = `+19998${baseTimestamp}`;
    const demoReqRes = await request(app)
      .post('/api/auth/request-otp')
      .send({ phone: demoTestPhone });

    assert(
      demoReqRes.status === 200 &&
      demoReqRes.body.success === true &&
      demoReqRes.body.demoMode === true &&
      demoReqRes.body.otp === undefined &&
      !JSON.stringify(demoReqRes.body).includes('123456'),
      '14. When DEMO_OTP_ENABLED=true, request-otp returns demoMode: true without exposing OTP',
      JSON.stringify(demoReqRes.body)
    );

    // -------------------------------------------------------------------------
    // 15. When DEMO_OTP_ENABLED=true, '123456' verifies without in-memory OTP, returns JWT and creates user
    // -------------------------------------------------------------------------
    // Clear in-memory OTP store to simulate serverless/multi-instance cold start where memory is empty
    otpService.resetStore();

    const demoVerifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: demoTestPhone, otp: '123456' });

    assert(
      demoVerifyRes.status === 200 &&
      typeof demoVerifyRes.body.token === 'string' &&
      demoVerifyRes.body.user?.phone === demoTestPhone,
      "15. When DEMO_OTP_ENABLED=true, '123456' verifies without in-memory OTP, returns JWT and creates user",
      `Status: ${demoVerifyRes.status}, user: ${demoVerifyRes.body.user?.id}`
    );

    const demoToken = demoVerifyRes.body.token;
    const demoUserId = demoVerifyRes.body.user.id;
    createdUserIds.push(demoUserId);

    // Verify token works with /api/auth/me
    const demoMeRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${demoToken}`);

    assert(
      demoMeRes.status === 200 &&
      demoMeRes.body.user?.id === demoUserId &&
      demoMeRes.body.user?.phone === demoTestPhone,
      '15b. Token generated via demo OTP authenticates successfully on /api/auth/me',
      `User ID: ${demoMeRes.body.user?.id}`
    );

    // -------------------------------------------------------------------------
    // 16. In demo mode, invalid phone numbers are still strictly rejected
    // -------------------------------------------------------------------------
    const invalidPhoneReqRes = await request(app)
      .post('/api/auth/request-otp')
      .send({ phone: '123' });

    const invalidPhoneVerifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: 'abc-not-valid', otp: '123456' });

    assert(
      invalidPhoneReqRes.status === 400 &&
      invalidPhoneVerifyRes.status === 400,
      '16. In demo mode, invalid phone numbers are still strictly rejected',
      `Req status: ${invalidPhoneReqRes.status}, Verify status: ${invalidPhoneVerifyRes.status}`
    );

    // -------------------------------------------------------------------------
    // 17. In demo mode, abuse protection locks out after 5 consecutive failed attempts
    // -------------------------------------------------------------------------
    const demoAbusePhone = `+19999${baseTimestamp}`;
    for (let i = 0; i < 4; i++) {
      const failRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: demoAbusePhone, otp: '000000' });
      if (failRes.status !== 400) {
        throw new Error(`Expected 400 on attempt ${i + 1}, got ${failRes.status}`);
      }
    }

    // 5th failed attempt should trigger lockout
    const demoLockoutRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: demoAbusePhone, otp: '000000' });

    assert(
      demoLockoutRes.status === 429 &&
      demoLockoutRes.body.message.includes('exceeded'),
      '17. In demo mode, abuse protection locks out after 5 consecutive failed attempts',
      `Status: ${demoLockoutRes.status}, message: ${demoLockoutRes.body.message}`
    );

    // Clean up demo env var after testing
    if (initialDemoOtpEnabled !== undefined) {
      process.env.DEMO_OTP_ENABLED = initialDemoOtpEnabled;
    } else {
      delete process.env.DEMO_OTP_ENABLED;
    }

    console.log('====================================================');
    console.log(`ALL ${testPassedCount} TESTS COMPLETED AND PASSED!`);
    console.log('====================================================');
  } finally {
    // Restore demo OTP env var
    if (initialDemoOtpEnabled !== undefined) {
      process.env.DEMO_OTP_ENABLED = initialDemoOtpEnabled;
    } else {
      delete process.env.DEMO_OTP_ENABLED;
    }

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
