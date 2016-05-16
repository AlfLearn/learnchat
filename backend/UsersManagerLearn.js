
var users = { }; // словарь авторизованных юзеров, ключи - ники, значения - структуры из socket-клиента и других служебных полей сессии (lastAtcive и т.п.)

var statusList = { };  // словарь всех проходящих юзеров, ключи - ники, значения - структуры из bool:online, onlineDate, lastMes, lastMesDate и т.п.

var PM = require('./ProfilesManagerLearn.js').CreateProfilesManager(); // менеджер профилей (зарегистрированных пользователей) с хранением в файле
//var PM = require('./ProfilesManagerMongoLearn.js').CreateProfilesManager(); // менеджер профилей (зарегистрированных пользователей) с хранением в mongo-db

var config = {
	userSilenceInterval: 3*60*1000, // сколько нужно молчать юзеру чтобы выпасть из списка (по сути - время сессии)
		// todo -для операторов время сессии можно делать даже неограниченным; точнее, для активных управляемых ими ботов
	userMonitorInterval: 60*1000 // интервал проверки молчащих юзеров (по умолчанию - каждую минуту)
};

// генерирует случайный токен для сессии:
function randomToken()
{
	var token = (Math.random() * 1000000000) | 0; // to int
	token = token ^ (Date.now() & 0xFFFFFFFF); // random в js без seed, потому добавим ещё больше случайности
	return token;
}

// запрос авторизации по обычному http-протоколу:
function initToken(req, res, nick, pass, token) // менеджер должен САМ вернуть структуру с токеном или ошибкой
{	// req передаю на случай, если понадобится проверка ещё каких-то полей (куки, айпи и т.д.)
	
	var errnick = CheckNick(nick);
	if(errnick!="") {
		res.send({ err:true, answ: errnick, token:0 });
		return;
	};
	
	pass = pass || "";
	
	PM.getProfile(nick, function(err, p) { //var p = PM.getProfile(nick); // это была синхронная версия
		
		if(err)
		{	res.send({ err:true, answ: "У нас проблемы с сервисом авторизации :-(", token:0 });
			return;
		};
		
		if(p) if(p.pass!=pass)
		{	res.send({ err:true, answ: "Неверный пароль для зарегистрированного ника", token:0 });
			return;
		};
		
		if(token==undefined || token=="" || token==0) token = randomToken();
		
		var u = users[nick];
		if(u)
		{
			if(u.token==token) // если сразу указан правильный токен, это та же сессия, всё ок:
			{	
				res.send({ token:token, answ:"ok" });
			}
			else // если нет - это вход с другого браузера и его можно разрешить только при правильном пароле
			{	
				if(pass=="") // если сессия открыта, а пароль пустой - перезаход точно недопустим:
				{	res.send({
						err:true, answ: "Этот ник уже авторизован в другом месте", token:0
					});
				}
				else 
				{
					if(p) // если пароль есть и он верный (проверено выше), то это перезаход с другого браузера:
						res.send({ token:u.token, answ:"ok", profile:p });
					else // а если пароль есть, а профиля нету, то ник таки занят:
						res.send({
							err:true, answ: "Только зарегистрированные юзеры могут заходить из других мест", token:0
						});
				}
			};
			u.lastConnectTime = Date.now();
			return;
		};
		
		// создадим структуру сессии юзера:
		var user = {
			nick:nick,
			token: randomToken(), //token, //(Math.random() * 1000000000) | 0, // to int
			lastAtcive: Date.now(), // время последней реплики (для оживления юзерлиста)
			lastConnectTime: Date.now(), // время последнего коннекта (при долгом молчании - отключаем)
			socket:undefined // сокета у нас пока нет, его должен создать клиент, зная токен
		};
		
		users[nick] = user;
		res.send({ token:user.token, answ:"ok", profile:p });
	});
};


// инициализация сокета по запросу клиента, проверяет соответствие ник-токен, при успехе - навешивает на сокет обработчики событий:
function initSocket(socket, nick, pass, token)
{
	socket.emit('statusList', statusList); // список юзеров отошлём сразу, независимо от успеха авторизациии,
	// это имеет смысл затем, чтобы было понятно, какие ники уже заняты или недавно использовались
	
	var user = users[nick];
	if(!user)
	{	socket.emit('message', {name:'chat', message: nick + " не авторизован на сервере"});
		socket.disconnect(); // не забываем разорвать соединение в этом случае
		return false;
	};
	
	// в этом месте можно попробовать авторизацию чисто по веб-сокету, т.е. проверить ник-пароль, а токен авторизации взять предложенный юзером
	
	if(user.token!=token)
	{	socket.emit('message', { name:'chat', message: nick + " имеет другой токен авторизации, вы хотите угнать ник? :) "});
		return false;
	};
	
	user.socket = socket;
	
	// реакция на публичное сообщение от юзера:
	socket.on('message', function(message) {
		try {
			var now = Date.now();
			if(user.lastAtcive) if((now - user.lastAtcive) < 500)
			{	user.socket.emit('message', {name:"chat", date:Date.now(), message:"*** Нельзя слать сообщения чаще, чем раз в 0.5 сек"} ); // сообщение общего чата
				return;
			};
			
			var mes = "<" + user.nick + "> " + message.message;
			sendToAll('message', {name:"chat", date:Date.now(), message:mes} ); // сообщение общего чата
			user.lastAtcive = now;
			
			updateUserStatusActive(user.nick, mes); // запомним последнее сообщение в statusList-е
			
		} catch (e) {
			console.log(e);
			socket.disconnect();
		}
	});
	
	// реакция на приватное сообщение от юзера:
	socket.on('pm', function (data){
		var fromNick = user.nick; //data.from;
		if(!(typeof(data) == "object")) return; // перестраховка
		var toNick = data.to || "Кучка"; // шутников надо ловить
		var msg = data.msg || "";
		var backmsg = ""; // в ответ надо что-то послать
		
		var now = Date.now(); // возвращает количество миллисекунд, прошедших с 1 января 1970 года
		
		if(user.lastAtcive) if((now - user.lastAtcive) < 500) 
		{	user.socket.emit('pm', { from:toNick, date:now, msg: "*** Нельзя слать сообщения чаще, чем раз в 0.5 сек"});
			return;
		};
		
		var toUser = users[toNick];
		if(toUser) 
		{
			if(toUser.socket) {
				// формат "<ник> сообщение" нужен, чтобы люди не могли послать pm в комнату от чужого имени
				toUser.socket.emit('pm', { from: fromNick, date:now, msg: "<" + fromNick + "> " + msg });
				backmsg = "<" + fromNick + "> " + msg;
			}
			else
				backmsg = "Ваше личное сообщение не доставлено, похоже что ваш собеседник - веб-юзер с нестабильной связью, попробуйте повторить позже (" + "< " + fromNick + "> " + msg + ")";
		} 
		else
		{
			backmsg = "Ваше личное сообщение не доставлено, похоже что ваш собеседник в оффлайне, попробуйте повторить позже (" + "< " + fromNick + "> " + msg + ")";
		};
		
		// пока на личках у нас не стоит никаких фильтров, мы можем сразу показать отправителю в приватном чате отправленное и как бы доставленное сообщение:
		if(backmsg!="")
			socket.emit('pm', { from:toNick, date: now, msg: backmsg });
		
		user.lastAtcive = Date.now(); // отправка личек тоже активность
	});
	
	// реакция на явную отправку команды выход:
	socket.on('quit', function(mes) {
		console.log(mes);
		socket.disconnect();
		onQuitUser(user);
	});
	
	// реакция на дисконнект со стороны клиента:
	socket.on('disconnect', function() {
		console.log("Закрыт сокет ника " + user.nick);
		user.lastConnectTime = Date.now(); // спустя некоторое время после дисконнекта закончится и сессия
		updateUserStatusOnline(user.nick, false); // запишем в statusList что юзер теперь оффлайн и в чат ему не напишешь
	});
	
	updateUserStatusOnline(user.nick, true); // запишем в statusList что юзер теперь онлайн и в чате
	
	// пока активен сокет, понятия "последняя активность" нет вовсе:
	user.lastConnectTime = undefined; // потому что он сам - открытое соединение
};


// отправка сообщения body типа type всем авторизованным юзерам:
function sendToAll(type, body)
{
	// мне как-то не нравится такой способ перебора, хоть в один массив ещё сваливай все сокеты для ускорения дела:
	for(nick in users)
	{	var user = users[nick];
		if(user.socket) // socket может меняться при переподключениях, потому его нужно выяснять каждый раз заново:
			user.socket.emit(type,body);
	};
};

// отправка сообщения bodу типа type юзеру nick, если он есть в списке авторизованных юзеров:
function sendToNick(nick, type, body)
{
	var user = users[nick];
	if(user && user.socket)
	{	user.socket.emit(type,body);
		return true;
	};
	return false;
}

// сахарок - запомним последнее сообщение юзера:
function updateUserStatusActive(nick, mes)
{
	var u = statusList[nick];
	if(!u) u = statusList[nick] = { nick:nick };
	u.lastMes = mes;
	u.lastMesDate = Date.now();
}

// изменим запись об онлайн-статусе юзера, уведомим об этом остальныx:
function updateUserStatusOnline(nick, b)
{
	var u = statusList[nick];
	if(!u) u = statusList[nick] = { nick:nick };
	u.online = b;
	u.onlineDate = Date.now();
	
	// при изменении статуса юзера разошлём об этом уведомление остальным:
	var sl = { }; sl[nick] = u; //statusList local - из одного юзера
	sendToAll('statusList', sl );
};

// сознательный выход по команде quit от сокета, от кнопки или автоматом - по таймауту:
function onQuitUser(user) 
{
	var u = users[user.nick];
	if(user==u)
	{	delete users[user.nick];
		console.log(user.nick + " вышел из списка юзеров");
	} else
		console.log(user.nick + " вышел, но был не найден в списке юзеров");
	
	if(user.socket) user.socket.disconnect(); // todo - переделать под массив сокетов, для возможности слушать с нескольких устройств:
};

// показывает в консоли авторизованных юзеров и отключает долго молчащих:
function usersMonitor()
{
	var now = Date.now(); // возвращает количество миллисекунд, прошедших с 1 января 1970 года
	var str = (new Date()).toLocaleTimeString() + " Активные юзеры: ";
	for(nick in users)
	{
		var u = users[nick];
		if(u.lastConnectTime) if((now - u.lastConnectTime) > config.userSilenceInterval) 
		{
			console.log(nick + " молчал дольше " + config.userSilenceInterval + " мс");
			onQuitUser(u);
			continue;
		};
		str+= nick + ", ";
	};
	str = str.substr(0,str.length-2);
	console.log(str);
	
	setTimeout(usersMonitor, config.userMonitorInterval);
};

// проверка допустимости ника:
function CheckNick(n)
{	var errmes = "";
	if( (n.indexOf("<")!=-1) || (n.indexOf(">")!=-1) || (n.indexOf(" ")!=-1) || (n.indexOf("\r")!=-1) || (n.indexOf("\n")!=-1) || (n.indexOf("\t")!=-1) ) 
	errmes+= "Ник не должен содержать угловых скобок и пробелов\r\n";
	if(n.length<2) errmes+= "Недопустимы ники меньше 2 символов\r\n";
	if(n.length>64) errmes+= "Недопустимы ники больше 64 символо\r\n";
	if(n.trim()=="") errmes+="Эээ, пустые ники, очевидно, недопустимы\r\n";
	return errmes;
}

// запрос регистрации по обычному http-протоколу (метод сам формирует res-ответ):
function registration(req, param, res)
{
	var nick = param.nick || "";
	var pass = param.pass || "";
	var mail = param.mail || "";
	var token = param.token || 0; // токен нужен чтобы уже зашедший под ником юзер мог зарегистрировать его
	var errmes = "";
	
	errmes+= CheckNick(nick); //if((nick.length<2)||(nick.length>64)) errmes+= "допустимая длинна ника о 2 до 64 символов\r\n";
	if(pass.length<3) errmes+= "пароль слишком короткий\r\n";
	if(mail.indexOf('@')==-1) errmes+= "не введено ничего похожего на почтовый адрес\r\n";
	
	var u = users[nick];
	if(u && u.token!=token) errmes+= "этот ник сейчас занят не вами\r\n";
	
	if(errmes!="")
	{	// если что-то не так во введённых полях - уже можно отказываться и возвращаться
		res.send({errmes:errmes});
		return;
	};
	
	PM.getProfile(nick, function(err,p) {
		
		if(err)
		{	res.send({ errmes: "У нас проблемы с сервисом авторизации :-("});
			return;
		};
		
		if(!p) p = { nick:nick };
		p.nick = nick;
		p.pass = pass;
		p.mail = mail;
		
		PM.setProfile(nick, p, function(err) {
			if(err)
			{	console.log(err);
				res.send({ errmes: "Изменения не сохранены, у нас проблемы с сервисом авторизации :-("});
			}
			else
				res.send({errmes:"", okmes:"ok", nick:nick, pass:pass });
		});
		
	});
};

// экспортная функция, запускает модуль и возвращает обьект со всеми методами, которыем мы хотим экспортировать:
function CreateUsersManager(options) 
{
	var um = {
		initSocket: initSocket, // initSocket(client, nick, pass, token); //навесит на сокет обработчики, если это разрешено для данного юзера
		initToken: initToken,
		registration:registration
	};
	
	if(options)
	{
		if(options.config) config = options.config;
	}
	
	PM.loadProfiles(); // загрузим профили (файл или кэш базы данных)
	
	usersMonitor(); // запустим мониторинг сессий сразу
	
	return um;
}

exports.CreateUsersManager = CreateUsersManager;