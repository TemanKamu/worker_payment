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
  bool,
  ic
} from "azle";
const user = Record({
  id: Principal,
  username: text,
  job: Record({
    title: text,
    salary: nat64,
  }),
  balance: nat64,
  getBalanceAt: text,
  nextGetBalanceAt: text,
  isLoggedIn: bool
});
const jobList: { title: text; salary: nat64 }[] = [
  {
    title: "Developer",
    salary: 100n,
  },
  {
    title: "Manager",
    salary: 250n,
  },
];
type JobList = typeof jobList | any;
type User = typeof user;
let accounts = StableBTreeMap<typeof Principal, User>(Principal, user,0);

export default Canister({
  // get all jobs
  getJobList: query([], Vec(Record({ title: text, salary: nat64 })), () => {
    return jobList;
  }),
  // Get payment worker
  claimSalaryWorker: update([], Result(text, text), () => {
    const userOpt = accounts.get(ic.caller());
    if ("None" in userOpt) {
      return Err(`Caller=${ic.caller()} needs to be a registered user.`);
    }
    const user : User = userOpt.Some;
    if (!user.isLoggedIn){
      return Err("User isn't logged in")
    }
    // Comparasion date
    const aboutDate = comparisonDate(
        getCurrentDate(),
        user.nextGetBalanceAt
    );

    if (!aboutDate) return Err("Already claim salary");
    if (typeof aboutDate === "number") {
      const toBigintDate = BigInt(aboutDate);
      // Update balance
      user.balance += user.job.salary * toBigintDate;
      // Update date getBalance
      user.getBalanceAt = user.nextGetBalanceAt;
      // Update nextGetBalanceat
      user.nextGetBalanceAt = getNextDate();
      
      // Update all
      accounts.insert(user.id, { ...user });
    }
    return Ok(`Success claim salary ${user.username}`);
  }),

  // Create worker account
  register: update(
    [text, text],
    Result(user, text),
    (username, job) => {
      const jobUser = getJobUser(job);
      // checks if job 
      if (!jobUser) {
        return Err(`Job not found. call method getJobList to get list of job`);
      }
      if (username.trim().length == 0){
        return Err("Username must not be empty.")
      }
      const caller = ic.caller();
      const isRegistered = accounts.containsKey(caller);

      if (isRegistered){
        return Err("Caller is already registered.")
      }
      const newAccount = {
        id: caller,
        username: username,
        balance: 0n,
        job: jobUser,
        getBalanceAt: getCurrentDate(),
        nextGetBalanceAt: getNextDate(),
        isLoggedIn: false
      };
      accounts.insert(newAccount.id, newAccount);
      return Ok(newAccount as User);
    }
  ),
  login: update([], Result(user, text), () => {
    const userOpt = accounts.get(ic.caller());
    if ("None" in userOpt) {
      return Err(`Caller=${ic.caller()} needs to be a registered user.`);
    }
    const user : User = userOpt.Some;
    if (user.isLoggedIn){
      return Err("Already logged in")
    }
    user.isLoggedIn = true;
    accounts.insert(user.id, user);
    return Ok(user)

  }),
  logout: update([], Result(text, text), () => {
    const userOpt = accounts.get(ic.caller());
    if ("None" in userOpt) {
      return Err(`Caller=${ic.caller()} needs to be a registered user.`);
    }
    const user : User = userOpt.Some;
    if (!user.isLoggedIn){
      return Err("User isn't logged in")
    }
    user.isLoggedIn = false;
    accounts.insert(user.id, user);
    return Ok("Logged out")
  }),
  getDetailAccount: query([], Result(user, text), () => {
    const userOpt = accounts.get(ic.caller());
    if ("None" in userOpt) {
      return Err(`Caller=${ic.caller()} needs to be a registered user.`);
    }
    const user : User = userOpt.Some;
    if (!user.isLoggedIn){
      return Err("User isn't logged in")
    }
    return Ok(user)
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
// Function to compare two dates
function comparisonDate(dateArg1: string, dateArg2: string): number | boolean {
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
  const yearComparasion = Number(new Date(date1.getTime() - date2.getTime()).getUTCFullYear() - 1970);
  const monthComparasion = comparisonDate2.month > comparisonDate1.month ? 
  comparisonDate2.month - (comparisonDate2.month - comparisonDate1.month):
  comparisonDate1.month - comparisonDate2.month
  ;

  // only return a number if there is a difference of at least one month or a year
  if (monthComparasion > 0 || yearComparasion > 0){
    // adds number of years * 12(number of months in a year) + months difference
    return yearComparasion * 12 + monthComparasion
  }else{
    return false;
  }
}

// Function to check whether the job matches a job title in the jobList variable
function getJobUser(job: text): Object | null {
  const jobtListUser = Array.from(jobList);
  const jobUser = jobtListUser.find((value: JobList) => {
    if (value.title === job) {
      return {
        title: value.title,
        salary: value.salary,
      };
    }
  });
  if (jobUser) return jobUser;
  else return null;
}