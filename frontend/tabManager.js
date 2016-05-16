//-----------------------------------------------------------------------------
// менеджер вкладок для работы с чатами 
// (коннекта тут ещё нет, только дизайн, завязанный на jqueryUI)
//-----------------------------------------------------------------------------

// Chat Visualizer
var chatvis = { //обьект-синглтон для создания коннекта с чатом
	
	ChatTabs: { }, // ключи - названия комнат, значения: mdiv - поле вывода сообщений, inp - поле ввода и т.д.
	TabContainer: null, // div к которому добавляются div-ы комнат, по умолчанию первый из $("#TabContainer");
	TabList: null, // ul к которому добавляются вкладки с названиями комнат, по умолчанию - первый из $("#TabList"); 
	
	//приватные поля для внутреннего пользования вроде как принято называть с префиксом "_" :
	_mainChat: null, // окно "главного чата", оно же - вкладка по умолчанию в методах, где её можно опускать
	_tabCounter: 0 // счётчик созданных вкладок, используется для выдачи им имён
};

// найти или создать новую чат-вкладку c именем name:
chatvis.getTabForName = function(name) 
{
	if(name.trim) name = name.trim();

	var c = this.ChatTabs[name];
	if(!c) 
	{
		var div = document.createElement('div');
		div.id = "tabdiv-" + (++this._tabCounter);
		div.className = "PanelChat";
		
			var mdiv = document.createElement('div');
			mdiv.className = "PanelMessages";
			//mdiv.innerHTML = "<p> Вкладка " + this.safe(name) + " (для закрытия введите !close)</p>";
			div.appendChild(mdiv);
		
			var psend = document.createElement('div');
			psend.className = "PanelSend";
		
				var inp = document.createElement('input');
				inp.className = "InputSend";
				inp.type = "text";
				inp.placeholder = "Введите здесь сообщение (отправка - Enter)";
					// превратим текстовое поле ввода в компонент с историей отправленных сообщений:
					var self = this;
					var hts = self.MakeHistorycalInput(inp, function() { //задаём ему событие, происходящее по нажатию Enter:
						self.sendMes(inp.value, c);
						self.setScrool(true,c); // при отправке сообщения прокрутку надо вернуть всегда
					});
				psend.appendChild(inp);
		
			div.appendChild(psend);
		
		this.TabContainer.appendChild(div);
		
		var li = document.createElement('li');
		li.id = "tabcapt_"+this._tabCounter;
		li.className = "CaptChat";
		li.innerHTML = "<a href='#"+ div.id + "'> " + this.safe(name) + " </a>";
		this.TabList.appendChild(li);
		
		c = { name:name, li: li, div: div, mdiv: mdiv, psend:psend, inp:inp, needScrool:true };
		this.ChatTabs[name] = c;
		
		// if(jqueryUI)
		$(this.TabContainer).tabs("refresh"); // кстати, единственнное обращение к jqueryUI в этом методе
		
		if(this.initTab) this.initTab(c); // обвеска вкладки специфичными для неё событиями
	};
	
	return c;
};

// удаляет вкладку, переводит фокус на главную:
chatvis.removeTab = function(c)
{
	if(c && this.ChatTabs[c.name]) // удалять можно то, что существует
	{
		this.TabContainer.removeChild(c.div); // по идее это удалит ивсе вложенные элементы и сборщик мусора до них дойдёт
		this.TabList.removeChild(c.li);
		$(this.TabContainer).tabs("refresh");
		delete this.ChatTabs[c.name];
		
		if(this._mainChat) this.showTab(this._mainChat); // при закрытии вкладки всегда переходим на _mainChat
		return true;
	};
	return false;
};

// показывает заданную вкладку:
chatvis.showTab = function(c)
{
	if(!c) return false;
	// var index = $('#tabs a[href="#simple-tab-2"]').parent().index(); // поиск индекса по ссылке в li-шке...
	//$("#TabContainer").tabs("option", "active", 0); // оказывается, метод select отменили и теперь так
	//$("#TabContainer").tabs("select", "#tabdiv-1"); // а когда-то работало даже так
	var index = $('#'+this.TabContainer.id +' a[href="#' + c.div.id + '"]').parent().index();
	index-=1; // из за того что есть одна li-шка которая меню, а не таб-влкадка
	$(this.TabContainer).tabs("option", "active", index);
	
	c.inp.focus(); //при переключении вкладок фокус нужно поставить в её поле ввода
	return true;
};

// задаёт название таб-вкладке (можно html-текст)
chatvis.setTabCaption = function(c, str)
{	// как-то мне очень не нравится реализация с поиском, может стоит запомнить ссылку на a-элемент при создании?
	$('#'+this.TabContainer.id +' a[href="#' + c.div.id + '"]')[0].innerHTML = str;
}

// оберётка для события выбора вкладки (над jqueryUI то ли select, то ли activate)
chatvis.onSelectTab = function(c)
{
	if(c.unread && c.unread>0)
	{	c.unread = 0;
		this.setTabCaption(c, chatvis.safe(c.name));// + " (" + c.unread+")");
	};
	this.tryScrool(c); // прокрутку имеет смысл делать только уже при активации вкладки
}

// сеттер для установки прокрутки и связанного с ней флажка настроек:
chatvis.setScrool = function(needScrool,c)
{
	c = c || this._mainChat;
	c.needScrool = needScrool;
	this.tryScrool(c); // если флажок прокрутки изменился на true - её нужно выполнить
	
	// если ко вкладке привязан флажок индицирующий прокрутку - здесь его нужно изменить:
	if(c.chBxSc) c.chBxSc.checked = needScrool; // needScrool?'checked':null;
};

// метод прокрутки к низу чата, иногда может быть перекрыт наследниками
chatvis.tryScrool = function(c)
{
	if(c.needScrool)
		c.mdiv.scrollTop = c.mdiv.scrollHeight; //mdiv.scrollTop+=1000000;
}

// обвеска вкладки специфичными для неё событиями:
chatvis.initTab = function(c) 
{
	// наследники могут формировать здесь начальное содержание вкладки
	// и задавать обработчики возможных на ней событий
	
	this.printMes("Создана вкладка: " + c.name, c, "SystemMessageStyle")
}

//-----------------------------------------------------------------------------
// действия по отправке сообщения во вкладку, зависят от типа окна и протокола:
//-----------------------------------------------------------------------------

// метод для "консольного" управленния вкладками:
chatvis.sendMesBase = function(str, c)
{
	if(str.indexOf("!tab")!=-1)
	{	var roomname = str.substr(5);
		var c = this.getTabForName(roomname);
		this.showTab(c);
		return true;
	};
	
	if(str=="!close") {
		if(c!=this._mainChat)
			this.removeTab(c);
		return true;
	};
	
	return false; // если вернули false - значит команда не наша
};

// пытается отправить соообщение str в чат вкладки c
// наследники почти обязаны перекрыть эту функцию, чтобы сделать вкладки функциональными:
chatvis.sendMes = function(str, c)
{
	if(this.sendMesBase(str,c)) return true; // служебные команды
	
	this.printMes(str,c); // а это просто пример простейшей печати
};

// печатает строку pstr в чат при помощи параграфов (класс параграфов можно задать):
chatvis.printMes = function(pstr, c, pClass)
{
	var d = c.mdiv; // целевой div, куда идут присланные параграфы
	
	pstr = this.safe(pstr);
	
	// немного дурацкое решение по визуализации табов
	pstr = pstr.replace(new RegExp("\t",'g'), '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
	// для "красной строки" сгодился бы text-indent, но что делать для внутренних? потому пока так
	
	var arrstr = pstr.split('\n');
	for(var i=0; i<arrstr.length; i++)
	{	var str = arrstr[i];
		if(str=='\r') continue; // на случай если строки разделялись по \r\n
		if(str=="") str="&nbsp;"; // пустая строка должна состоять хоть из одного символа
		
		var p = document.createElement("p");
		p.className = pClass || "dp"; // или просто className не задавать если его нет?
		p.innerHTML = str; //p.appendChild(document.createTextNode(str));
		d.appendChild(p);//c.mdiv.appendChild(p);
	};
	
	this.tryScrool(c); 	//if(c.needScrool) c.mdiv.scrollTop = c.mdiv.scrollHeight; 
};

// печатает датированное сообщение во вкладку с именем roomname стилем cls, основной метод вывода чатов:
chatvis.addMessage = function(date, messtr, roomname, cls)
{
	var c = roomname?this.getTabForName(roomname):this._mainChat;
	var prestr = "[" + (new Date(date)).toLocaleTimeString() + "] " + messtr;
	this.printMes(prestr, c, cls);
	
	// счётчик непрочитанных сообщений для неактивных вкладок (нужен ли такой на главной, кстати?)
	if(this.activeTab!=c)
	{	c.unread = (c.unread || 0) + 1;
		this.setTabCaption(c, chatvis.safe(c.name) + " (" + c.unread+")");
	};
};

//-----------------------------------------------------------------------------
// инициализация, разумеется тоже может перекрываться:
//-----------------------------------------------------------------------------

chatvis.Init = function(opt)
{
	opt = opt || { }; // может лучше дефолтные настройки тут грузить?

	this.TabContainer = opt.TabContainer || document.getElementById("TabContainer");
	this.TabList = opt.TabList || document.getElementById("TabList");
	
	if((!this.TabContainer) ||(!this.TabList)) return false;
	
	$(this.TabContainer).tabs();
	
	var self = this;
	// обработчик события перехода на одну из вкладок:
	$(this.TabContainer).tabs({activate: function( event, ui ) {
		var d = ui.newPanel[0];
		for(name in self.ChatTabs)
		{	var c = self.ChatTabs[name];
			if(c.div==d)
			{	self.activeTab = c; // запомним активную вкладку
				//console.log("нажата вкладка " + self.ChatTabs[name].name);
				if(self.onSelectTab) self.onSelectTab(self.ChatTabs[name]);
			};
		};
	}});
	
	var c = this.getTabForName(opt.MainChatName || "чат");
	c.mdiv.appendChild(document.createTextNode("Вкладка главного чата создана"));
	this._mainChat = c;
	this.showTab(c);
	
	// научим наше окно работать с контекстными панелями, закрывающимися по клику вне них:
	//this.makeContextDivArea(this.TabContainer);
	this.makeContextDivArea(window.document);
	
	return true;
};


//-----------------------------------------------------------------------------
// утилиты - статичные методы, которые когда-нибудь уйдут в отдельный модуль:
//-----------------------------------------------------------------------------

//задаёт область, внутри которой работают контекстные панели:
chatvis.makeContextDivArea = function(area)
{
	// contextDiv - это "контекстная" панель, которая закрывается при клике вне неё
	// contextArea - область внутри которой такие закрывающие клики можно делать.
	area.onmousedown = function(e)
	{
		if(window.contextDiv) //может искать сразу класс таких скрываемых панелей?
		{	var cm = window.contextDiv;
			if( !cm.contains(e.target) && (cm!=e.target))
			{ cm.style.display = 'none';
				window.contextDiv = undefined;
			};
		};
	};
};

// принимает на вход int-представление даты, возвращает строку времени с датой если она дольше суток от заданной
chatvis.dateStr = function(date, now) {
	if((now - date) < 3600000) //86400000)
		return (new Date(date)).toLocaleTimeString();
	else
		return (new Date(date)).toLocaleString();
};

// заменяет символы html на их безопасное представление:
chatvis.safe = function (str) {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// превращает input-элемент в компонент с историей ввода, которой можно делать навигацию по стрелкам:
chatvis.MakeHistorycalInput = function (el, onEnterCallback)
{
	var hist = []; // массив всех отправленных соообщений
	var histIndex=-1; // индекс (при отправке ставится в hist.length)
	
	var ts = el; // text send
	
	function Add() // эту функцию нужно вызвать чтобы вручную добавить новое сообщение в историю
	{	onEnterCallback();
		hist.push(ts.value); histIndex = hist.length; // не забываем добавить отправленное в историю
		ts.value = '';
	};
	
	ts.onkeydown = function (e) {
		e = e.which;
		
		if (e == 13)
		{	onEnterCallback();
			hist.push(ts.value); histIndex = hist.length;
			ts.value='';
			return false;
		}
		
		// работа с историей сообщений
		if(e==38) // up arrow
		{	histIndex--; if(histIndex<0) histIndex = 0;
			ts.value = hist[histIndex];
			ts.focus(); //ts.setSelectionRange(0, ts.value.length);// ts.selectionStart=0; ts.selectionEnd = ts.value.length; 
			ts.selectionStart = ts.value.length;
			return false;
		}
		if(e==40) // down arrow
		{	histIndex++; // if(histIndex>=(hist.length-1)) histIndex = (hist.length-1);
			if(histIndex>hist.length) histIndex = hist.length;
			if(histIndex == hist.length) ts.value = ""; else  // последний переход вниз - пустая строка
			ts.value = hist[histIndex]; 
			ts.focus(); //ts.setSelectionRange(0, ts.value.length);//ts.selectionStart=0; ts.selectionEnd = ts.value.length;
			ts.selectionStart = ts.value.length;
			return false;
		}
		
		return true;
	};
	
	// вернём объект для управления историей сообщений, если кому надо:
	return { Add:Add, hist:hist, histIndex:histIndex }; // например, чтобы отправить сообщение по кнопке, а не Enter, вызвав Add
}