import {
  query,
  update,
  text,
  Record,
  StableBTreeMap,
  Principal,
  nat64,
  Canister,
  Err,
  Ok,
  Result,
  Vec,
} from "azle";
const user = Record({
  id: Principal,
  username: text,
  password: text,
  job: Record({
    name: text,
    salary: nat64,
  }),
  balance: nat64,
  getBalanceAt: text,
  nextGetBalanceAt: text,
});
const jobList: { name: text; salary: nat64 }[] = [
  {
    name: "Developer",
    salary: 100n,
  },
  {
    name: "Manager",
    salary: 250n,
  },
];
type JobList = typeof jobList | any;
type User = typeof user | object;
let currentUser: User | undefined;
let accounts = StableBTreeMap<Principal, User>(0);

export default Canister({
  // get all jobs
  getJobList: query([], Vec(Record({ name: text, salary: nat64 })), () => {
    return jobList;
  }),
  // Get payment worker
  claimSalaryWorker: update([], Result(text, text), () => {
    // Auth validation
    if (!currentUser) return Err("Please login or register first");
    // Comparasion date
    const aboutDate = comparasionDate(getCurrentDate(), user.nextGetBalanceAt);
    if (!aboutDate) return Err("Already claim salary");
    if (typeof aboutDate === "number") {
      const toBigintDate = BigInt(aboutDate);
      // Update balance
      currentUser.balance += currentUser.job.salary * toBigintDate;
      // Update date getBalance
      currentUser.getBalanceAt = currentUser.nextGetBalanceAt;
      // Update nextGetBalanceat
      currentUser.nextGetBalanceAt = getNextDate();

      // Update all
      accounts.insert(currentUser.id, { ...currentUser });
    }
    return Ok(`Success claim salary ${currentUser.username}`);
  }),

  // Create worker account
  register: update(
    [text, text, text],
    Result(user, text),
    (username, password, job) => {
      if (currentUser) return Err("Your already login, u need to logout first");
      const jobUser = getJobUser(job);
      if (!jobUser) {
        return Err(`Job not found. call method getJobList to get list of job`);
      }
      const allUsers = Array.from(accounts.values());
      if (allUsers.length > 0) {
        const userDetail = allUsers.filter((value: User) => {
          return value.username === username;
        })[0];
        if (userDetail) {
          return Err(`User already exist`);
        }
      }
      const newAccount: User | any = {
        id: generateID(),
        username: username,
        password: password,
        balance: 0n,
        job: jobUser,
        getBalanceAt: getCurrentDate(),
        nextGetBalanceAt: getNextDate(),
      };
      accounts.insert(newAccount.id, newAccount);
      return Ok(newAccount);
    }
  ),
  login: update([text, text], Result(user, text), (username, password) => {
    if (currentUser) return Err("Already login");
    const allUsers = Array.from(accounts.values());
    if (allUsers.length > 0) {
      const userDetail = allUsers.filter((value: User) => {
        return value.username === username;
      })[0];

      if (!userDetail) {
        return Err(`User not found`);
      } else if (userDetail.password !== password) {
        return Err(`Wrong password`);
      } else {
        currentUser = userDetail;
        return Ok(userDetail);
      }
    } else {
      return Err("users are empty");
    }
  }),
  logout: update([], Result(text, text), () => {
    if (!currentUser) {
      return Err("You are not login");
    }
    currentUser = undefined;
    return Ok("Logout successfully.");
  }),
  getDetailAccount: query([], Result(user, text), () => {
    if (currentUser) {
      return Ok(currentUser);
    } else {
      return Err("Login or register first");
    }
  }),
  /* 
    if you want get all account you can ative this code
    getAllAccount: query([], Result(Vec(user), text), () => {
    //   const allUsers = Array.from(accounts.values());
    //   if (allUsers.length > 0) {
    //     return Ok(allUsers);
    //   } else {
    //     return Err("No users found");
    //   }
     }), 
     
     */
});

function getNextDate(next = 1): string {
  const date = new Date();

  const nextMonth = ((date.getMonth() + next) % 12) + 1;
  const detailDate = {
    day: date.getDate(),
    month: nextMonth,
    year: date.getFullYear(),
  };
  if (nextMonth === 1) {
    return `${detailDate.year + 1}-${detailDate.month}-${detailDate.day + 1}`;
  }
  return `${detailDate.year}-${detailDate.month}-${detailDate.day}`;
}
function getCurrentDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
function comparasionDate(dateArg1: string, dateArg2: string): number | boolean {
  const date1 = new Date(dateArg1);
  const date2 = new Date(dateArg2);
  const comparisonDate1 = {
    year: date1.getFullYear(),
    month: date1.getMonth() + 1,
    day: date1.getDate(),
  };
  const comparisonDate2 = {
    year: date2.getFullYear(),
    month: date2.getMonth() + 1,
    day: date2.getDate(),
  };
  const yearComparasion = Number(
    new Date(date1.getTime() - date2.getTime()).getUTCFullYear() - 1970
  );
  const monthComparasion =
    comparisonDate2.month > comparisonDate1.month
      ? comparisonDate2.month - (comparisonDate2.month - comparisonDate1.month)
      : comparisonDate1.month - comparisonDate2.month;
  // only return a number if there is a difference of at least one month or a year
  if (monthComparasion > 0 || yearComparasion > 0) {
    // adds number of years * 12(number of months in a year) + months difference
    return yearComparasion * 12 + monthComparasion;
  } else {
    return false;
  }
}
function generateID(): Principal {
  return Principal.fromUint8Array(Uint8Array.from([Number(accounts.len())]));
}
function getJobUser(job: text): Object | null {
  const jobtListUser = Array.from(jobList);
  const jobUser = jobtListUser.find((value: JobList) => {
    if (value.name === job) {
      return {
        name: value.name,
        salary: value.salary,
      };
    }
  });
  if (jobUser) return jobUser;
  else return null;
}
