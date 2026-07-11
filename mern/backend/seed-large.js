const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
const User = require('./models/user');
const Job = require('./models/job');
const Application = require('./models/application');
const Certificate = require('./models/certificate');
const OfferLetter = require('./models/offerLetter');
const Review = require('./models/review');
const Notification = require('./models/notification');
const connectDB = require('./config/database');
require('dotenv').config();

// Configuration
const COUNTS = {
  admin: 5,
  hr: 15,
  user: 80,
  jobs: 50,
  applications: 500,
  reviews: 100,
  certificates: 50,
  offerLetters: 50
};

const departments = ['IT', 'Development', 'Design', 'Operations', 'Data Science', 'Marketing', 'Sales', 'HR'];
const positions = [
  'Senior Developer', 'Junior Developer', 'Frontend Developer', 'Backend Developer', 
  'Full Stack Developer', 'UI/UX Designer', 'DevOps Engineer', 'Data Scientist', 
  'Project Manager', 'Product Manager', 'HR Manager', 'Software Engineer Intern'
];
const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const locations = ['Remote', 'On-site', 'Hybrid'];
const cityLocations = ['New Delhi, India', 'Bangalore, India', 'Mumbai, India', 'Hyderabad, India', 'Pune, India'];

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('🔌 Connected to database for large seeding');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Job.deleteMany({}),
      Application.deleteMany({}),
      Certificate.deleteMany({}),
      OfferLetter.deleteMany({}),
      Review.deleteMany({}),
      Notification.deleteMany({})
    ]);
    console.log('🧹 Cleared existing data');

    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Generate Users
    console.log('👤 Generating users...');
    const usersData = [];
    const usedEmails = new Set();
    let empCounter = 1;

    const getUniqueEmail = (baseEmail) => {
      let email = baseEmail.toLowerCase();
      let counter = 1;
      while (usedEmails.has(email)) {
        const parts = baseEmail.split('@');
        email = `${parts[0]}${counter}@${parts[1]}`.toLowerCase();
        counter++;
      }
      usedEmails.add(email);
      return email;
    };

    const getNextEmpId = (prefix) => {
      const id = `${prefix}${empCounter.toString().padStart(3, '0')}`;
      empCounter++;
      return id;
    };
    
    // Always include the main admin
    const mainAdminEmail = 'contact@gmail.com';
    usedEmails.add(mainAdminEmail);
    usersData.push({
      name: 'Admin User',
      email: mainAdminEmail,
      password: passwordHash,
      role: 'super-admin',
      status: 'active',
      department: 'IT',
      position: 'IT Manager',
      employeeId: getNextEmpId('EMP')
    });

    for (let i = 0; i < COUNTS.admin - 1; i++) {
      usersData.push({
        name: faker.person.fullName(),
        email: getUniqueEmail(faker.internet.email()),
        password: passwordHash,
        role: 'admin',
        status: 'active',
        department: 'IT',
        position: 'Admin',
        employeeId: getNextEmpId('ADM')
      });
    }

    for (let i = 0; i < COUNTS.hr; i++) {
      usersData.push({
        name: faker.person.fullName(),
        email: getUniqueEmail(faker.internet.email()),
        password: passwordHash,
        role: 'employee',
        status: 'active',
        department: 'HR',
        position: 'HR Executive',
        employeeId: getNextEmpId('HR')
      });
    }

    for (let i = 0; i < COUNTS.user; i++) {
      const isEmployee = faker.datatype.boolean(0.3); // 30% are employees
      usersData.push({
        name: faker.person.fullName(),
        email: getUniqueEmail(faker.internet.email()),
        password: passwordHash,
        role: 'user',
        status: isEmployee ? 'active' : faker.helpers.arrayElement(['inactive', 'former', 'suspended']),
        department: isEmployee ? faker.helpers.arrayElement(departments) : undefined,
        position: isEmployee ? faker.helpers.arrayElement(positions) : undefined,
        employeeId: isEmployee ? getNextEmpId('EMP') : undefined
      });
    }

    const createdUsers = await User.insertMany(usersData);
    const admins = createdUsers.filter(u => u.role === 'admin');
    const regularUsers = createdUsers.filter(u => u.role === 'user');
    console.log(`✅ Created ${createdUsers.length} users`);

    // 2. Generate Jobs
    console.log('💼 Generating jobs...');
    const jobsData = [];
    for (let i = 0; i < COUNTS.jobs; i++) {
      const dept = faker.helpers.arrayElement(departments);
      const pos = faker.helpers.arrayElement(positions);
      jobsData.push({
        title: `${faker.person.jobArea()} ${pos} ${i + 1}`,
        company: 'FMPG',
        description: faker.lorem.paragraphs(2),
        requirements: Array.from({ length: 4 }, () => faker.lorem.sentence()),
        responsibilities: Array.from({ length: 4 }, () => faker.lorem.sentence()),
        location: faker.helpers.arrayElement([...locations, ...cityLocations]),
        type: faker.helpers.arrayElement(jobTypes),
        salary: `₹${faker.number.int({ min: 30, max: 150 })},000 - ₹${faker.number.int({ min: 160, max: 300 })},000`,
        department: dept,
        position: pos,
        postedBy: faker.helpers.arrayElement(admins)._id,
        isActive: faker.datatype.boolean(0.8), // 80% active
        isPublished: true,
        questions: [
          {
            questionText: `Years of experience in ${dept}?`,
            questionType: 'text',
            required: true,
            order: 0
          },
          {
            questionText: 'Rate your skills in this domain',
            questionType: 'rating',
            required: true,
            maxRating: 5,
            order: 1
          }
        ]
      });
    }
    const createdJobs = await Job.insertMany(jobsData);
    console.log(`✅ Created ${createdJobs.length} jobs`);

    // 3. Generate Applications
    console.log('📝 Generating applications...');
    const applicationsData = [];
    for (let i = 0; i < COUNTS.applications; i++) {
      const job = faker.helpers.arrayElement(createdJobs);
      const user = faker.helpers.arrayElement(regularUsers);
      const status = faker.helpers.arrayElement(['pending', 'reviewing', 'shortlisted', 'offered', 'rejected', 'hired']);
      
      applicationsData.push({
        jobId: job._id,
        userId: user._id,
        fullName: user.name,
        email: user.email,
        phone: faker.phone.number(),
        experience: faker.lorem.sentences(2),
        education: faker.lorem.sentence(),
        skills: Array.from({ length: 5 }, () => faker.hacker.adjective() + ' ' + faker.hacker.noun()),
        coverLetter: faker.lorem.paragraph(),
        status: status,
        isReferred: faker.datatype.boolean(0.1), // 10% referred
        questionAnswers: job.questions.map(q => ({
          questionId: q._id,
          questionText: q.questionText,
          questionType: q.questionType,
          answer: q.questionType === 'text' ? faker.lorem.sentence() : faker.number.int({ min: 1, max: 5 })
        })),
        createdAt: faker.date.past({ years: 1 })
      });
    }
    const createdApplications = await Application.insertMany(applicationsData);
    console.log(`✅ Created ${createdApplications.length} applications`);

    // 4. Generate Reviews
    console.log('⭐ Generating reviews...');
    const reviewsData = [];
    for (let i = 0; i < COUNTS.reviews; i++) {
      const user = faker.helpers.arrayElement(createdUsers);
      const status = faker.helpers.arrayElement(['pending', 'approved', 'rejected']);
      reviewsData.push({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        rating: faker.number.int({ min: 1, max: 5 }),
        title: faker.lorem.sentence().substring(0, 100),
        content: faker.lorem.paragraph().substring(0, 1000),
        department: user.department || faker.helpers.arrayElement(departments),
        position: user.position || faker.helpers.arrayElement(positions),
        workType: faker.helpers.arrayElement(locations),
        employmentDuration: faker.helpers.arrayElement(['less than 1 year', '1-2 years', '2+ years', '5+ years']),
        pros: faker.lorem.sentences(2).substring(0, 500),
        cons: faker.lorem.sentences(2).substring(0, 500),
        status: status,
        approvedBy: status === 'approved' ? faker.helpers.arrayElement(admins)._id : undefined,
        approvedAt: status === 'approved' ? new Date() : undefined,
        reviewerType: user.role === 'admin' || user.role === 'super-admin' || user.status === 'active' ? 'employee' : 'candidate',
        isAnonymous: faker.datatype.boolean(0.2)
      });
    }
    const createdReviews = await Review.insertMany(reviewsData);
    console.log(`✅ Created ${createdReviews.length} reviews`);

    // 5. Generate Certificates
    console.log('🏆 Generating certificates...');
    const certificatesData = [];
    for (let i = 0; i < COUNTS.certificates; i++) {
      const user = faker.helpers.arrayElement(createdUsers);
      certificatesData.push({
        userId: user._id,
        name: user.name,
        domain: faker.helpers.arrayElement(departments),
        jobrole: faker.helpers.arrayElement(positions),
        fromDate: faker.date.past({ years: 1 }),
        toDate: new Date(),
        issuedBy: 'FMPG'
      });
    }
    await Certificate.insertMany(certificatesData);
    console.log(`✅ Created ${COUNTS.certificates} certificates`);

    // 6. Generate Offer Letters
    console.log('📋 Generating offer letters...');
    const offerLettersData = [];
    for (let i = 0; i < COUNTS.offerLetters; i++) {
      const user = faker.helpers.arrayElement(regularUsers);
      offerLettersData.push({
        userId: user._id,
        candidateName: user.name,
        email: user.email,
        position: faker.helpers.arrayElement(positions),
        department: faker.helpers.arrayElement(departments),
        salary: faker.number.int({ min: 300000, max: 2000000 }),
        startDate: faker.date.future(),
        joiningLocation: faker.helpers.arrayElement(locations),
        workType: faker.helpers.arrayElement(['On-site', 'Remote', 'Hybrid']),
        benefits: ['Health Insurance', 'PF', 'Paid Leave'],
        reportingManager: faker.person.fullName(),
        companyName: 'FMPG',
        hrContactName: 'HR Team',
        hrContactEmail: 'fmpg974@gmail.com',
        hrContactPhone: faker.phone.number(),
        issuedBy: 'FMPG',
        status: faker.helpers.arrayElement(['Pending', 'Accepted', 'Rejected']),
        validUntil: faker.date.future()
      });
    }
    await OfferLetter.insertMany(offerLettersData);
    console.log(`✅ Created ${COUNTS.offerLetters} offer letters`);

    console.log('🎉 Large database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in large seeding:', error);
    process.exit(1);
  }
};

seedDatabase();
