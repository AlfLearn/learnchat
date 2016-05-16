//-----------------------------------------------------------------------------
// всякие красивости, обслуживающие конкретную реализацию чата:
//-----------------------------------------------------------------------------

var imgHost = "http://localhost/"; // изображения с этого адреса не перемасташбируются

// немного странное переопределение метода, надо будет переделать под прототипное наследование:
chatvis.InitConnectOld = chatvis.InitConnect;
chatvis.InitConnect = function(opt)
{
	chatvis.InitConnectOld(opt); // вызываем версию этого метода от предка
	
	// обвешаем событиями контейнер списка юзеров:
	this.UserListContainer = opt.UserListContainer || document.getElementById("UserListContainer");
	this.initUserListMenu(this.UserListContainer);
};

// определим событие задание темы чата:
chatvis.onTopic = function(str)
{
	document.title = "Тема чата: " + str;
	var pt = document.getElementById("PanelTopic");
	if(pt) 
	{	pt.innerHTML = chatvis.safe(str);
		pt.title = str;
		this.addMessage(Date.now(), "Установлена тема чата: " + str, undefined, "SystemMessageStyle");
	};
};

// заполняет контекстное меню и возвращает ссылку на него, но не позиционирует его:
// внимание, менюшки завязаны на элементы по id, это не компонент а частный UI
chatvis.makeContextMenu = function(nick, c, isTab)
{
	if(!c) c = this._mainChat;
	
	var cm = document.getElementById("UserContextMenu");
	if(!cm) return false;
	
	var self = this;
	
	document.getElementById("ContextNick").innerHTML = nick;
	
	document.getElementById("ContextPM").onclick = function() {
			var c = self.getTabForName(nick);
			if(c) self.showTab(c);
			cm.style.display = 'none';
		};
		
	document.getElementById("ContextAM").onclick = function() {
		// по-хорошему тут бы надо писать просто в активную вкладку...
		c.inp.value = nick + ": " + c.inp.value;
		c.inp.focus();
		cm.style.display = 'none';
	};
	
	document.getElementById("ContextNickInfo").onclick = function() {
		var u = chatvis.statusMan.statusList[nick];
		if(u)
		{	var str = nick + "\r\n";
			if(u.onlineDate) {
				if(u.online) str+="online с "; else str+="offline с ";
				
				str+= (new Date(u.onlineDate)).toLocaleString() + "\r\n";
			};
			if(u.lastMes && u.lastMesDate)
			{	str+="\r\nАктивность в чате:\r\n"
				//str+="[" + (new Date(u.lastMesDate)).toLocaleString() + "] ";
				str+="[" + chatvis.dateStr(u.lastMesDate, Date.now()) + "] ";
				str+=u.lastMes;
			};
			alert(str); // это ужасно
		}
		else alert("Нет информации про "+nick);
		cm.style.display = 'none';
	};
	
	var ctc = document.getElementById("ContextTabClose");
	if(ctc) 
	{	// если это контекстная менюшка вкладки, ей ещё добавляется пунктов:
		if(isTab && (c!=this._mainChat)) 
		{	ctc.style.display = 'block';
			ctc.onclick = function() {
				self.removeTab(c);
				cm.style.display = 'none';
			};
		} else
		ctc.style.display = 'none';
	};
	
	// эта функция не позиционирует меню, потому что размещение может отличаться
	// в зависимости от места вызова, подправляться для разных мест экрана и т.д.
	// т.е. этим должен заниматься или вызывающий, или специальный менеджер
	return cm;
}

// при создании вкладки задаём для неё контекстные события:
chatvis.initTab = function(c)
{
	var self = this;
	
	c.mdiv.oncontextmenu = function(e)
	{	
		if(e.target.classList.contains("NickStyle"))
		{	var nick = e.target.innerHTML;
			
			var cm = self.makeContextMenu(nick, c);
			if(!cm) return true;
			
			cm.style.display = 'block';
			cm.style.left = (e.pageX-0)+"px";
			cm.style.right = 'auto';
			cm.style.top = (e.pageY-0)+"px";
			cm.style.bottom = 'auto';
			window.contextDiv = cm;
			e.preventDefault();
			return false;
		};
	};
	
	c.li.oncontextmenu = function(e)
	{
		var cm = self.makeContextMenu(c.name, c, true);
		if(!cm) return true;
		
		if(c==self._mainChat) return;
		
			cm.style.display = 'block';
			cm.style.left = (e.pageX-0)+"px";
			cm.style.right = 'auto';
			cm.style.bottom = //(e.pageY-0)+"px";
				(document.documentElement.clientHeight - e.pageY) + "px";
			cm.style.top = 'auto';
			window.contextDiv = cm;
			e.preventDefault();
			return false;
	}
	
	c.mdiv.onclick = function(e)
	{
		if(e.target.classList.contains("NickStyle"))
		{	var nick = e.target.innerHTML;
			c.inp.value = nick + ": " + c.inp.value;
			c.inp.focus();
		};
	};
	
	c.mdiv.addEventListener(
		'load',
		function(event){
			var tgt = event.target;
			if( tgt.tagName == 'IMG'){ // может тут ещё её класс проверять?
				// почему-то вызывается 2 раза на картинку, но в принципе работает
				chatvis.tryScrool(c);
				//здесь можно рассылать уведомление о загрузке
			}
		},
		true //true // <-- useCapture
	);
		
		
	c.chBxSc = document.createElement('input');
	//c.chBxSc.className = "CheckBoxScrool";
	c.chBxSc.type = "CheckBox";
	c.chBxSc.checked = 'checked';
	c.chBxSc.onclick = function() { self.setScrool(c.chBxSc.checked,c); };
	c.chBxSc.title="Автоматичесая прокрутка чата при появлении новых сообщений";
	//c.chBxSc.innerHTML = "прокрутка"; // так нельзя, input - элемент с игнорируемым содержимым
	c.psend.appendChild(c.chBxSc);
};

// задаём контекстные меню для списка юзеров (единоразово):
chatvis.initUserListMenu = function(ulDiv)
{
	var self = this;
	var cmf = function(e)
	{
		if(e.target.classList.contains("NickStyle"))
		{	var nick = e.target.innerHTML;
			
			var c = self.ChatTabs[nick];
			var cm = self.makeContextMenu(nick, c, c);
			//var cm = self.makeContextMenu(nick);
			if(!cm) return true;
			
			cm.style.display = 'block';
			cm.style.left = 'auto';
			cm.style.right = //(e.pageX-0)+"px"; // юзерлист справа, его менюшки - слева
				(document.documentElement.clientWidth - e.pageX) + "px";
			cm.style.top = (e.pageY-0)+"px";
			cm.style.bottom = 'auto';
			window.contextDiv = cm;
			e.preventDefault();
			return false;
		};
	};
	
	ulDiv.onclick = cmf; // для смартфонов, у них нет правой кнопки вовсе...
	ulDiv.oncontextmenu = cmf;
};

// метод добавления сообщения учитывает особенности викторины:
chatvis.addMessage = function(date, messtr, roomname, cls)
{
	var c = roomname?this.getTabForName(roomname):this._mainChat;
	var mdiv = c.mdiv;
	
	messtr = messtr
		.replace(/&/g, '&amp;')
		.replace(new RegExp("\t",'g'), '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'); // пока не придумаем лучшей замены tab-ам
	//messtr = messtr.replace(new RegExp("\t",'g'), '        ');
	
	// блок анализа ника:
	var nick = "";
	var prestr ="";
	var j = messtr.indexOf("<");
	if(j!=-1) 
	{	var j1 = messtr.indexOf(">", j+1);
		if(j1!=-1)
		{	nick = messtr.substring(j+1, j1);
			var cln = "NickStyle"; // вообще здесь должно быть что-то вроде cln = nickStyles(nick);
			prestr = messtr.substring(0,j) + "&lt;<b class="+ cln +" >" + nick + "</b>&gt;";
			//подстрока перед ником обычно означает время, её можно бы сделать более бледным цветом
			messtr = messtr.substring(j1+1);
		};
	};
	// замену угловых скобок можно делать только прочтения ника:
	messtr = messtr.replace(/</g, '&lt;').replace(/>/g, '&gt;');
	
	// создаём div для нового сообщения:
	var d = document.createElement("div");
	cls = cls || "dp";
	d.className = cls; // css-класс сообщения можно определять в зависимости от ника
	
	// todo: разрешать обработку ссылок в сообщениях по настройкам группы отправителя
	messtr = this.makeLinks(messtr, nick);
	
	// время соообщения можно и не показывать или выдавать только по подсказке, или загонять в правый угол.. и т.д.
	prestr = "<span class='TimeStyle'>[" + (new Date(date)).toLocaleTimeString() + "]</span> " + prestr;
	messtr = prestr + messtr;
	
	// разобьём сообщение на параграфы:
	var arrstr = messtr.split('\n');
	var l=arrstr.length;
	
	if(l<2) { // маленькая оптимизация - если пришла одна строчка, её не обязательно бить на параграфы
		d.innerHTML = arrstr; // но осторожнее с ней, она может где-то нарушить общность
	} else
	
	for(var i=0; i<l; i++)
	{	var str = arrstr[i];
		if(str=='\r') continue; // на случай если строки разделялись по \r\n
		if(str=="") str="&nbsp;"; // пустая строка должна состоять хоть из одного символа
		
		var p = document.createElement("p");
		p.className = "dp"; 
		p.innerHTML = str; //p.appendChild(document.createTextNode(str));
		d.appendChild(p); 
	};
	
	mdiv.appendChild(d);
	
	if(c==this.activeTab)
		this.tryScrool(c); // прокрутка нужна только для активной вкладки
	else
	if(c!=this._mainChat) // на главной слишком много событий, уведомлять можно разве что при личных обращениях
	{	// счётчик непрочитанных сообщений для неактивных вкладок 
		c.unread = (c.unread || 0) + 1;
		this.setTabCaption(c, chatvis.safe(c.name) + " (" + c.unread+")");
	};
}

// ищет в строке ссылки и заменяет их на a- или a+img-тэги для картинок:
chatvis.makeLinks = function(str, nick)
{
	str=str.replace(/((https?\:\/\/|ftp\:\/\/)|(www\.))(\S+)(\w{2,4})(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/gi, function(url) {
		nice = url;
		if( url.match('^https?:\/\/') ) nice = nice.replace(/^https?:\/\//i,'')
		else url = 'http://' + url;
		
		// разрешение на преобразование ссылок в картинки тоже должно бы зависеть от настроек для группы ника:
		var r=/.(jpg|jpeg|gif|png|bmp)$/i;
		if(nick!="") // в системных соообщениях (вроде уведомлений о личках) загрузка картинок не нужна (кажется)
		if (r.test(url))
		{	// может проще было бы определять стиль по нику отправителя, а не по адресу в ссылке?
			var cls = (url.indexOf(imgHost + "img") == -1)?"ImgUsersStyle":"ImgVikaStyle";
			return '<a href="'+ url +'" target="_blank"> <img src="'+ url +'" class="' + cls + '" align="top" /></a>';
		};
		
		return '<a target="_blank" rel="nofollow" href="'+ url +'">'+ url +'</a>';
	});
	
	return str;
}



// реакция на statusList-сообщение - создание, добавление или обновление полей юзера:
chatvis.statusMan.statusUpdate = function(nick, opt)
{
	var u = this.statusList[nick];
	if(!u) {
		u = { nick:nick, online:false, onlineDate:0, lastMes:"", lastMesDate:0 };
		this.statusList[nick] = u;
		this.statusArr.push(u);
	};
	
	// "подмешивание" обновок статуса к уже существующим полям:
	for(key in opt) u[key] = opt[key];
	
	// пользователя явно заинтересует приход-уход людей в его лс-вкладках:
	if(nick in chatvis.ChatTabs)
	if("online" in opt) // и только если изменение касается онлайн-статуса
	{	var c = chatvis.ChatTabs[nick];
		if(u.online)
		{	c.li.classList.add("NickOnlineStyle");
			c.li.classList.remove("NickOfflineStyle");
			chatvis.addMessage(u.onlineDate, "*** " + nick + " is online", nick, "SystemMessageStyle");
		} else
		{	c.li.classList.add("NickOfflineStyle");
			c.li.classList.remove("NickOnlineStyle");
			chatvis.addMessage(u.onlineDate, "*** " + nick + " is offline", nick, "SystemMessageStyle");
		}
	}
	// раскраска без толку, jQueryUI перекрывает мои стили своими :(
};

// отрисовка списка юзеров, при хорошем binding-е будет не нужна, но пока увы:
chatvis.statusMan.statusRender = function()
{
	this.statusArr.sort(this.sortMesDate); // сортировка по дате последнего отправленного сообщения
	
	var now = Date.now();
	var title="";
	var h = "<br><br><b>Список юзеров:</b><br><br>";
	for(var i=0; i<this.statusArr.length; i++)
	{	u = this.statusArr[i];
		if(true) // if(u.lastMesDate!=0) // для учебного чата покажем вообще всех
		{	title = "[ " + chatvis.dateStr(u.lastMesDate, now) + "] " + u.lastMes;
			
			if(u.onlineDate!=0) // у ботов (вроде информера) нет даты входа, потому что они никогда и не входили
			{	if(u.online) title+= "\r\nonilne с "; else title+="\r\noffline с ";
					title+= chatvis.dateStr(u.onlineDate, now);
			};
			
			if(u.online) 
				 h+= "<p class='NickStyle NickOnlineStyle' title='" + title + "'>" + u.nick + "</p>";
			else h+= "<p class='NickStyle NickOfflineStyle' title='" + title + "'>" + u.nick + "</p>";
		};
	};
	
	//document.getElementById("UserListContainer").innerHTML = h;
	this.chatvis.opt.UserListContainer.innerHTML = h; // это можно как-то сократить?
};