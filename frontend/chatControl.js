//-----------------------------------------------------------------------------
// инициализация компонента:
//-----------------------------------------------------------------------------

// сервер, реализующий api (может отличаться от адреса сайта с которого идут запросы к api, потому указываем явно):
//chatvis.apihost =  "http://localhost:10003"; 
//chatvis.apihost =  "http://alfavika.ru:10003"; 

// инициализация, в основном - панели авторизации:
chatvis.InitConnect = function(opt)
{
	opt = opt || {};
	opt.ButtonAuth = opt.ButtonAuth || document.getElementById("ButtonAuth");
	opt.ButtonQuit = opt.ButtonQuit || document.getElementById("ButtonQuit");
	opt.InputNick = opt.InputNick || document.getElementById("InputNick");
	opt.InputPass = opt.InputPass || document.getElementById("InputPass");
	opt.PanelAuth = opt.PanelAuth || document.getElementById("PanelAuth");
	opt.NickMenu = opt.NickMenu || document.getElementById("NickMenu");
	opt.UserListContainer = opt.UserListContainer || document.getElementById("UserListContainer");
	// todo - при отсутствии указанных элементов самому их и создавать?

	this.opt = opt; //запомним настройки
	
	this.Init(opt); //"конструктор" предка
	 
	$(this.opt.ButtonAuth).click(this.doAuth.bind(this)); // действие по кнопке "вход"
	
	// вкусовщина - по enter-у в полях ввода ника или пароля можно сразу осуществить вход и перейти в поле ввода:
	document.getElementById("InputNick").onkeydown = 
	document.getElementById("InputPass").onkeydown = function (e) {
		e = e.which;
		if (e == 13) {
			chatvis.doAuth();
			chatvis._mainChat.inp.focus();
			return false;
		}
		return true;
	};
	
	$("#ButtonAcc").click(function(){
		//$("#PanelProfile").toggle();
		var isOpen = $("#PanelProfile").dialog("isOpen" );
		if(isOpen) $("#PanelProfile").dialog("close");
		else $("#PanelProfile").dialog("open");
	});
	
	$("#ButtonUpdateProfile").click(this.doUpdateProfile.bind(this));
	
	return true;
};

// регистрация или обновление профиля (написано на коленке, перепишется напрочь):
chatvis.doUpdateProfile = function()
{
	$.ajax({
		url: chatvis.apihost+'/api1/registration',
		type: "post",
		data: { nick:$("#InputRegNick").val(), pass:$("#InputRegPass").val(), mail:$("#InputRegEmail").val(), token:chatvis.getToken() },
		// processData: false, 
		dataType: 'json',  // ожидаем ответ в формате json
		success: function(data){
			console.dir(data);
			
			if(data.errmes && data.errmes!="") {  // если ошибка 
				alert(data.errmes); // и обьясним в чём состоит ошибка
			} else 
			{	// при успешной регистрации или обновлении
				alert("Профиль успешно обновлён");
				// установим их и в обычные поля:
				$(chatvis.opt.InputNick).val(data.nick);
				$(chatvis.opt.InputPass).val(data.pass);
			};
		},
		error: function(e){
			console.log("reg-err");
			alert('Ошибка запроса обновления профиля');
		}
	});
}


//-----------------------------------------------------------------------------
// непосредственная работа с протоколом веб-сокета для данного чата:
//-----------------------------------------------------------------------------

chatvis.doAuth = function() // может быть вызвана по кнопке "вход" или при автозагрузке страницы
{
	var nick = $(this.opt.InputNick).val();
	var pass = $(this.opt.InputPass).val();
	var token = this.getToken(); // если есть запомненный токен, можно попробовать зайти с ним
	var self = this; // для замыканий
	
	$(this.opt.PanelAuth).hide(); // пока не дождёмся ответа - отключим всю панель
	
	$.ajax({
		url: chatvis.apihost+'/api1/dclogin',
		type: "post",
		data: {n:nick, p:pass, token:token},
		// processData: false, 
		dataType: 'json',  // ожидаем ответ в формате json
		success: function(data){
			console.dir(data);
			self.token = data.token; // токен запоминаем в любом случае (0 - это всё плохо)
			if(data.err) {  // если ошибка 
				$(self.opt.PanelAuth).show(); // вернем панель авторизации
				alert(data.answ); // и обьясним в чём состоит ошибка
			} else 
			{	// при успешной авторизации 
				$(self.opt.ButtonQuit).show(); //покажем кнопку выхода
				self.authNick = nick; // и запомним ник, для которого она удалась
				self.authPass = pass; // не помню зачем его запоминать, но зачем-то нужно было :)
				
				// обработка профилей написана на коленке, для реальных задач будет сильно переписана:
				if(data.profile) // если ник зарегистрирован, в ответ на авторизацию приходит профиль
				{	$("#ButtonAcc").html("Профиль");
					$("#InputRegNick").val(data.profile.nick);
					$("#InputRegEmail").val(data.profile.mail);
					$("#InputRegPass").val(data.profile.pass);
				}
				else $("#ButtonAcc").html("Зарегистрировать");
				
				self.Connect(); // и запустим веб-сокет (с полученным токеном)
			};
		},
		error: function(e){
			console.log("mes-err");
			$(self.opt.PanelAuth).show(); // если не дождались - вернём панельку авторизации
			alert('Таймаут соединения'); // и напишем что-нибудь грустное
		}
	});
}

chatvis.getToken = function()
{
	return this.token || 0; // пока храним токен прямо в обьекте
	// но вообще его можно попробовать брать из куки или localStorage
}

// вызывать эту функцию для инициализации сокета (обычно по кнопке авторизации-входа):
chatvis.Connect = function()
{
	var nick = this.authNick;
	var pass = this.authPass;
	var token = this.getToken(); // токен должен быть получен при авторизации и храниться либо в полях, либо в хранилище
	if((token==undefined)||(token==0)) return; // если его нет - всё плохо
	
	var connectparams = "?n=" + decodeURIComponent(nick);
	if(pass) connectparams+='&p='+decodeURIComponent(pass);
	if(token) connectparams+='&token='+decodeURIComponent(token);
	
	var socket = io.connect(chatvis.apihost+connectparams, {transports: ['websocket','pooling']});
	this._socket = socket;
	
	var self = this; // перед назначением событий замкнём контекст
	var opt = this.opt; // сокращение
	var statusMan = this.statusMan; // сокращение
	
	// функция для системных сообщений красненьким цветом:
	function msg_system(message) {
		self.addMessage(Date.now(), message, undefined, "SystemMessageStyle");
	};
	
	socket.on('connecting', function () {
		msg_system('Соединение...');
	});

	socket.on('connect', function () {
		msg_system('Соединение установленно!');
		$(opt.ButtonQuit).show(); $(opt.PanelAuth).hide(); // при каждом коннекте auth-панель прячем
		opt.NickMenu.innerHTML = self.safe(nick); // покажем с каким ником зашли
		$(opt.ButtonQuit).click( function () {
			$(opt.ButtonQuit).hide();
			$(opt.PanelAuth).show();
			socket.emit("quit", "Button quit pressed");
			//socket.disconnect(); // пусть разрыв делает сервер, в ответ на quit
		});
	});
	
	// сообщение присылается при успешной авторизации и содержит служебную информацию:
	socket.on('hello', function(data) {
			if(data.token && localStorage) localStorage.setItem("chatToken", data.token);
			if(data.topic) self.onTopic(data.topic); // топик (тема) чата
			self.token = data.token; // запомним токен хотя бы до перезагрузки страницы
	})
	
	socket.on('disconnect', function () {
		msg_system('Соединение закрыто.');
		$(opt.PanelAuth).show();
		$(opt.ButtonQuit).hide();
	});

	socket.on('message', function (data) {
		self.addMessage(data.date || Date.now(), data.message);
		if(statusMan) statusMan.statusCheck(data.date, data.message);
	});
	
	socket.on('pm', function(data) {
		msg_system("[ЛС: "+data.from+"] " + data.msg);
		self.addMessage(data.date || Date.now(), data.msg, data.from);
	});
	
	if(statusMan) // statusList ловим только если есть менеджер для них:
	socket.on('statusList', function(data) {
		for(var nick in data)
			statusMan.statusUpdate(nick, data[nick]);
		// в render-функции сначала произойдёт сортировка, потом отрисовка:
		statusMan.statusRender();
	});
	
	// реакция на команду $HubTopic, в будущем будет заменена на широкую обработку команд
	socket.on('HubTopic', function(data) {
		if(self.onTopic) self.onTopic(data);
	});

	// сюда можно дописывать расширения протокола
};

// перекрытваем метод отправки соообщения str в чат вкладки c:
chatvis.sendMes = function(str, c)
{
	if(this.sendMesBase(str,c)) return true; // служебные команды
	
	c = c || this._mainChat;
	var socket = this._socket;
	if(socket)
	{
		if(c==this._mainChat)
			socket.emit("message", {message: str}); // обычное текстовое сообщение
		else
			socket.emit("pm", { msg:str, to:c.name } ); // приватное сообщение (или в какую-то комнату, тут неважно)
		return true;
	}
	return false; // обычно это означает что вы не авторизованы и нужно что-то делать
	// но в принципе, можно вернуть и причину неприятностей в виде текстовой строки
};


//-----------------------------------------------------------------------------
// менеджмент списка юзеров частично зависим от протокола, потому здесь описана
// его базовая версия, а наследники могут заменить в ней почти всё:
//-----------------------------------------------------------------------------

chatvis.statusMan = 
{
	statusList: {}, // обновляемый словарь списка юзеров
	statusArr: [], // сортируемый массив этих же юзеров
	chatvis:chatvis //ссылка на владельца (на всякий случай)
};

// реакция на statusList-сообщение - создание, добавление или обновление полей юзера:
chatvis.statusMan.statusUpdate = function(nick, opt)
{
	var u = this.statusList[nick];
	if(!u) {
		u = { // поля описывающие стату юзера (обновки к которым может присылать сервер)
			nick:nick,
			online:false,
			onlineDate:0, // дата последнего изменения online-статуса
			lastMes:"",  // последнее замеченное сообщение от юзера в чате
			lastMesDate:0 // дата этого сообщения
		};
		this.statusList[nick] = u;
		this.statusArr.push(u);
	};
	
	// "подмешиваем" изменения только в присланные поля юзера (а не заменяем все)
	for(key in opt) u[key] = opt[key];
	
	// в этом месте ещё можно писать системные "юзер пришёл/ушёл",
	// но обычно это интересно только относительно избранных юзеров, о списках которых пусть заботятся потомки
};

// сортировка по дате последнего сообщения:
chatvis.statusMan.sortMesDate = function (a,b)
{
	if (a.lastMesDate < b.lastMesDate) return 1;
	if (a.lastMesDate > b.lastMesDate) return -1;
	return 0;
};

// отрисовка списка юзеров, при хорошем binding-е будет не нужна, но пока увы:
chatvis.statusMan.statusRender = function()
{
	this.statusArr.sort(this.sortMesDate);
	
	var now = Date.now();
	var h = "<br><br><b>Список юзеров:</b><br><br>";
	for(var i=0; i<this.statusArr.length; i++)
	{	u = this.statusArr[i];
		if(u.lastMesDate==0) continue; // покажем только тех, кто недавно (по мнению сервера) писал в чате
		if(u.online) h+="<b>";
		var title = "[" + (new Date(u.lastMesDate)).toLocaleTimeString() + "] " + u.lastMes;
		if(u.onlineDate) // у ботов (вроде информера) нет даты входа, потому что они никогда и не входили
		{	if(u.online) title+= "\r\nonilne с "; else title+="\r\noffline с ";
			if((now - u.onlineDate)< 3600000) //86400000) // для дат меньше часа/суток назад - можно только время
				title+=(new Date(u.onlineDate)).toLocaleTimeString();
			else
				title+=(new Date(u.onlineDate)).toLocaleString();
		};
		h+= "<p class='NickStyle' title='" + title + "'> " + chatvis.safe(u.nick) + "</p>";
		if(u.online) h+="</b>";
	};
	
	//document.getElementById("UserListContainer").innerHTML = h;
	this.chatvis.opt.UserListContainer.innerHTML = h; // это можно как-то сократить?
};

// dc-specific - по дефолтному протоколу ники отправителей идут с первого символа в угловых скобках,
// потому проверяя новые строки чата, можно обновить статус автора реплики:
chatvis.statusMan.statusCheck = function(date, mes)
{
	if(mes.charAt(0)=="<")
	{	var i = mes.indexOf(">");
		if(i>1)
		{	var nick = mes.substring(1,i);
			this.statusUpdate(nick, { lastMes:mes, lastMesDate:date });
			this.statusRender();
		}
	}
};