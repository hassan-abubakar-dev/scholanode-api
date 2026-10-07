const pricingConfig = {
  FREE: [],
  
  STARTER: [
    {
      id: "STARTER_1_300",
      minStudents: 1,
      maxStudents: 300,

      MONTHLY: {
        price: 15000,
        asLowAs: 50,
      },

      TERMLY: {
        price: 35000,
        asLowAs: 116.67,
      },

      YEARLY: {
        price: 100000,
        asLowAs: 333.33,
      },
    },

    {
      id: "STARTER_301_500",
      minStudents: 301,
      maxStudents: 500,

      MONTHLY: {
        price: 22000,
        asLowAs: 44,
      },

      TERMLY: {
        price: 50000,
        asLowAs: 100,
      },

      YEARLY: {
        price: 140000,
        asLowAs: 280,
      },
    },

    {
      id: "STARTER_501_700",
      minStudents: 501,
      maxStudents: 700,

      MONTHLY: {
        price: 30000,
        asLowAs: 42.86,
      },

      TERMLY: {
        price: 70000,
        asLowAs: 100,
      },

      YEARLY: {
        price: 190000,
        asLowAs: 271.43,
      },
    },

    {
      id: "STARTER_701_1000",
      minStudents: 701,
      maxStudents: 1000,

      MONTHLY: {
        price: 40000,
        asLowAs: 40,
      },

      TERMLY: {
        price: 95000,
        asLowAs: 95,
      },

      YEARLY: {
        price: 260000,
        asLowAs: 260,
      },
    },

    {
      id: "STARTER_1001_1500",
      minStudents: 1001,
      maxStudents: 1500,

      MONTHLY: {
        price: 55000,
        asLowAs: 36.67,
      },

      TERMLY: {
        price: 130000,
        asLowAs: 86.67,
      },

      YEARLY: {
        price: 350000,
        asLowAs: 233.33,
      },
    },

    {
      id: "STARTER_1501_2000",
      minStudents: 1501,
      maxStudents: 2000,

      MONTHLY: {
        price: 70000,
        asLowAs: 35,
      },

      TERMLY: {
        price: 165000,
        asLowAs: 82.5,
      },

      YEARLY: {
        price: 450000,
        asLowAs: 225,
      },
    },

    {
      id: "STARTER_2001_UNLIMITED",
      minStudents: 2001,
      maxStudents: null,

      MONTHLY: {
        price: 85000,
        asLowAs: null,
      },

      TERMLY: {
        price: 200000,
        asLowAs: null,
      },

      YEARLY: {
        price: 550000,
        asLowAs: null,
      },

      message: "Price based on your number of students",
    },
  ],

  STANDARD: [],

  PROFESSIONAL: [],
};

export default pricingConfig;