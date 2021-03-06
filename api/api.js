const app = require("express").Router();
const { default: axios } = require("axios");
const db = require("../database/database");
const cache = new Map();

function checkDB(req, res, next) {
  req.dbReady = false;
  if (db && db.connection.readyState == 1) req.dbReady = true;
  return next();
}

function setError(msg) {
  return {
    error: true,
    message: msg
  };
}

app.get("/japanrate.json", checkDB, async (req, res) => {
  if (!req.dbReady) return res.send({ value: 132.25 });
  let config = db.model("Config");
  let jpnrate = await config.findOne({ configname: "japan_rate" });
  if (!jpnrate) return res.send({ value: 132.25 });
  return res.send({ value: jpnrate.value });
});

app.get("/showroom/log", checkDB, async (req, res, next) => {
  // if (!req.query.id) return next();
  if (!req.dbReady) return res.send([]);
  let srLog = db.model("ShowroomLog");
  let sr = db.model("Showroom");
  let log;
  let query = req.query.page;
  let search = req.query.search;
  let limit = 15;
  if (req.query.limit) {
    limit = parseInt(req.query.limit);
    if (!limit || isNaN(limit)) limit = 15;
    limit = limit > 0 && limit <= 15 ? limit : 15;
  }

  let members;

  if (!cache.has("jkt48members"))
    try {
      members = await sr.find({ group: "jkt48" }).select({ room_id: 1 });
      members = members.map(i => i.room_id);
      if (!cache.has("jkt48members")) {
        cache.set("jkt48members", members);
      }
    } catch (e) {
      return res.send([]);
    }

  members = cache.get("jkt48members");
  if (members == null) return res.send([]);
  let sort = req.query.sort ? req.query.sort : "newest";

  let sortOption = {
    newest: { created_at: -1 },
    oldest: { created_at: 1 },
    highest: { total_point: -1 },
    lowest: { total_point: 1 }
  };

  try {
    sort = sortOption[sort];
    sort = sort ? sort : sortOption.newest;
  } catch (e) {
    sort = sortOption.newest;
  }

  let page = query && !isNaN(query) && query > 0 ? query : null;
  let select = {
    room_info: 1,
    total_point: 1,
    created_at: 1,
    live_info: {
      start_date: 1,
      end_date: 1
    },
    data_id: 1,
    room_id: 1
  };

  sort._id = 1;
  let s = {
    room_id: members
  };
  if (search) {
    let mirip = (
      await sr.find({ room_id: members, name: new RegExp(search, "i") })
    ).map(i => i.room_id);

    // console.log(mirip);
    s["room_id"] = mirip;
  }

  if (!process.env.IS_DEV) s.is_dev = false;

  if (page) {
    log = await srLog
      .find(s, select)
      .populate({
        path: "room_info",
        select: "-_id name img url -room_id"
      })
      .sort(sort)
      .skip((page - 1) * 15)
      .limit(limit)
      .lean();
  } else {
    log = await srLog
      .find(s, select)
      .populate({
        path: "room_info",
        select: "-_id name img url -room_id"
      })
      .sort(sort)
      .limit(limit)
      .lean();
  }
  // if()

  res.send(
    log.map(i => {
      if (!i.room_info)
        i.room_info = {
          name: "Nama tidak ditemukan!",
          url: "",
          img:
            "https://image.showroom-cdn.com/showroom-prod/assets/img/v3/img-err-404.jpg?t=1602821561",
          group: null
        };
      return i;
    })
  );
});

app.get("/showroom", checkDB, async (req, res) => {
  if (!req.dbReady) return res.send([]);
  let srdb = db.model("Showroom");
  return res.send(
    await srdb
      .find({ group: "jkt48" })
      .sort("name")
      .lean()
  );
});

app.get("/members/jkt48.json", checkDB, async (req, res) => {
  if (!req.dbReady) return res.send([]);
  let jkt48 = db.model("Member");
  return res.send(
    await jkt48
      .find({ group: "jkt48" })
      .sort("name")
      .lean()
  );
});

// app.get("/showroom/live", async (req, res, next) => {
//   if (!showroom) return res.send([]);
//   let d = showroom.getLive();
//   return res.send(d);
// });

app.get("/showroom/log/:id", checkDB, async (req, res, next) => {
  if (!req.dbReady)
    return res.status(401).send(setError("DB not initialized!"));

  let ext = ".json";
  let id = req.params.id;
  if (id.slice(id.length - ext.length, id.length) == ext) {
    id = id.slice(0, id.length - ext.length);
    let srLog = db.model("ShowroomLog");

    try {
      let data = await srLog.getDetails(id);

      if (data) {
        return res.send({ data: data });
      }
    } catch (e) {
      console.log(e);
    }
  }

  return res.send({
    data: null
  });
});

app.get("/showroom/user/gifts", checkDB, async (req, res, next) => {
  if (!req.dbReady)
    return res.status(401).send(setError("DB not initialized!"));

  if (!req.query.user_id) return res.status(404).send(setError("Not Found!"));

  let logDB = db.model("ShowroomLog");
  let userDB = db.model("Showroom_User");

  let user = await userDB.findOne({ user_id: req.query.user_id });
  if (user) {
    try {
      let usergifts = await logDB.getUserGiftDetail(
        parseInt(req.query.user_id)
      );
      return res.send(usergifts);
    } catch (e) {
      console.log(e);
      return res.status(500).send(setError("Error!"));
    }
  }

  return res.status(404).send(setError("Not Found!"));
});

// app.get("/showroom/user/total_gift", checkDB, async (req, res, next) => {
//   if (!req.dbReady)
//     return res.status(401).send(setError("DB not initialized!"));

//   let page = 0;
//   if (req.query.page) page = req.query.page;

//   let logDB = db.model("ShowroomLog");

//   try {
//     let usergifts = await logDB.getUserGifts(page);
//     return res.send(usergifts);
//   } catch (e) {
//     console.log(e);
//     return res.status(500).send(setError("Error!"));
//   }
// });

app.get("/showroom/user/ranks", checkDB, async (req, res, next) => {
  if (!req.dbReady)
    return res.status(401).send(setError("DB not initialized!"));

  let page = 1;
  if (req.query.page) page = req.query.page;
  if (page < 1) page = 1;

  let perpage = 50;

  let userdb = db.model("Showroom_User");

  try {
    let usergifts = await userdb
      .find({})
      .sort({ point: -1 })
      .skip((page - 1) * perpage)
      .limit(perpage);

    let result = {
      list: usergifts
    };

    if (req.query.count != null && req.query.count) {
      let total = await userdb.count({}).catch(e => 0);
      result = {
        total,
        perpage: perpage,
        ...result
      };
    }
    return res.send(result);
  } catch (e) {
    console.log(e);
    return res.status(500).send(setError("Error!"));
  }
});

app.get("/showroom/next_live", checkDB, async (req, res, next) => {
  if (!req.dbReady)
    return res.status(401).send(setError("DB not initialized!"));

  if (cache.has("next_live")) {
    let data = cache.get("next_live");
    return res.send(data);
  } else {
    try {
      let srDB = db.model("Showroom");
      let jkt48member = await srDB
        .find({ group: "jkt48" })
        // .select("-_id name img url room_id -description -group")
        .select({ name: 1, img: 1, url: 1, room_id: 1 })
        .lean();

      let promises = [];

      for (let member of jkt48member) {
        promises.push(
          new Promise(async (resolve, reject) => {
            try {
              // { epoch: null, text: 'TBD' } epcoch ada kalo nextlive ada
              let { data } = await axios.get(
                "https://www.showroom-live.com/api/room/next_live",
                {
                  params: {
                    room_id: member.room_id,
                    _: new Date().getTime()
                  }
                }
              );

              return resolve({ ...member, ...data });
            } catch (e) {
              return resolve(null);
            }
          })
        );
      }

      let data = await Promise.all(promises);

      data = data.filter(i => i && i.epoch);
      if (!cache.has("next_live")) {
        cache.set("next_live", data);
        setTimeout(() => {
          cache.delete("next_live");
        }, 60000 * 5);
      }
      return res.send(data);
    } catch (e) {
      console.log(e);
      return res.send([]);
    }
  }
});

app.get("/showroom/now_live", checkDB, async (req, res, next) => {
  if (!req.dbReady)
    return res.status(401).send(setError("DB not initialized!"));

  if (cache.has("now_live")) {
    let data = cache.get("now_live");
    return res.send(data);
  } else {
    try {
      let srDB = db.model("Showroom");
      let jkt48member = await srDB
        .find({ group: "jkt48" })
        // .select("-_id name img url room_id -description -group")
        .select({ name: 1, img: 1, url: 1, room_id: 1 })
        .lean();

      let promises = [];

      for (let member of jkt48member) {
        promises.push(
          new Promise(async (resolve, reject) => {
            try {
              //https://www.showroom-live.com/api/live/telop
              let { data } = await axios.get(
                "https://www.showroom-live.com/room/is_live",
                {
                  params: {
                    room_id: member.room_id,
                    _: new Date().getTime()
                  }
                }
              );

              return resolve({
                ...member,
                ...data
              });
            } catch (e) {
              return resolve(null);
            }
          })
        );
      }

      let data = await Promise.all(promises);

      data = data.filter(i => i && i.ok);

      let proms = [];

      for (let d of data) {
        proms.push(
          new Promise(async (resolve, reject) => {
            try {
              //https://www.showroom-live.com/api/live/telop
              let { data: profile } = await axios.get(
                "https://www.showroom-live.com/api/room/profile",
                {
                  params: {
                    room_id: d.room_id,
                    _: new Date().getTime()
                  }
                }
              );

              return resolve({
                ...d,
                is_onlive: profile.is_onlive,
                start_date: profile.current_live_started_at
              });
            } catch (e) {
              return resolve(null);
            }
          })
        );
      }

      let onlives = await Promise.all(proms);

      if (!cache.has("now_live")) {
        cache.set("now_live", onlives);
        setTimeout(() => {
          cache.delete("now_live");
        }, 60000 * 1);
      }
      return res.send(onlives);
    } catch (e) {
      console.log(e);
      return res.send([]);
    }
  }
});

app.get("/*", async (req, res, next) => {
  if (req.url.startsWith("/user/profile?user_id=")) return next();
  return res.status(404).send({
    error: true,
    message: "Not Found!"
  });
});

module.exports = app;
