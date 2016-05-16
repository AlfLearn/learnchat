

/*  Функция построения меню по ul-списку внутри div-а с классом horizontalcssmenu.
Взята с http://javascriptt.ru/menu20.html , не забываем подключать соответствующий css
*/
function initMenu(){
	if(makeVikaMenu) makeVikaMenu(); //так почему-то писать нельзя
	
	var cssmenuids=["cssmenu1"] //Enter id(s) of CSS Horizontal UL menus, separated by commas
	var csssubmenuoffset=-1 //Offset of submenus from main menu. Default is 0 pixels.
	function createcssmenu2(){
	for (var i=0; i<cssmenuids.length; i++){
	  var ultags=document.getElementById(cssmenuids[i]).getElementsByTagName("ul")
		for (var t=0; t<ultags.length; t++){
				ultags[t].style.top=ultags[t].parentNode.offsetHeight+csssubmenuoffset+"px"
			var spanref=document.createElement("span")
				spanref.className="arrowdiv"
				spanref.innerHTML="    "
				ultags[t].parentNode.getElementsByTagName("a")[0].appendChild(spanref)
			ultags[t].parentNode.onmouseover=function(){
						this.style.zIndex=1000000
			this.getElementsByTagName("ul")[0].style.visibility="visible"
						this.getElementsByTagName("ul")[0].style.zIndex=0
			}
			ultags[t].parentNode.onmouseout=function(){
						this.style.zIndex=0
						this.getElementsByTagName("ul")[0].style.visibility="hidden"
						this.getElementsByTagName("ul")[0].style.zIndex=1000000
			}    }  }}
	/*
	if (window.addEventListener)
	window.addEventListener("load", createcssmenu2, false)
	else if (window.attachEvent)
	window.attachEvent("onload", createcssmenu2)
	*/
	createcssmenu2();
}


function addSubMenu(mainmenu, sname, sid)
{
	var elm = document.createElement('li');
	if(sid) elm.innerHTML = ' <a id="' + sid + '" href="javascript:void(0);">' + sname + '</a> '; else
	elm.innerHTML = ' <a href="javascript:void(0);">' + sname + '</a> ';
	
	var eul = document.createElement('ul');
	elm.appendChild(eul);
	
	mainmenu.appendChild(elm);
	return eul;
}

function addItem(submenu, sname, sjs)
{
	var elm = document.createElement('li');
	elm.innerHTML = ' <a href="javascript:void(0);" onclick="'+ sjs + '" >' + sname + '</a> ';
	submenu.appendChild(elm);
}

// служебная функция изменяющая размер шрифта на заданную величину:
function changeFont(element,step)
{	step = parseInt(step,10);
	var el = document.getElementById(element);
	var curFont = parseInt(el.style.fontSize,10);
	el.style.fontSize = (curFont+step) + 'px';
}

// внимание, для работы этого меню должна быть определена глобальная функция window.sm для отправки в главный чат
function makeVikaMenu()
{
	var mm = document.getElementById("cssmenu1");
	var m;
	
	m = addSubMenu(mm, "Вы","you"); // you должен быть, по нему делается замена ника
		addItem(m, "Моя статистика", "sm('!myscore');");
		addItem(m, "Задать пароль", "setPswProc();");
		addItem(m, "--");
		addItem(m, "Выйти", "squit();");
	
	m = addSubMenu(mm, "меню2","idmenu2");
		addItem(m, "Действие21", "some21();");
		addItem(m, "Действие21", "some22();");
	
	m = addSubMenu(mm, "меню3","idmenu3");
		addItem(m, "Действие31", "some31();");
		addItem(m, "Действие31", "some32();");
	
	// а для работы этого меню, понятно, должен существовать элемент с id=TabContainer
	m = addSubMenu(mm, "Вид","idvid");
		addItem(m, "Шрифт крупнее", "changeFont('TabContainer',1);");
		addItem(m, "Шрифт мельче", "changeFont('TabContainer',-1);");
};