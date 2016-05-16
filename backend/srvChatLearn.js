var config = 
{
	PORT:10003, // к этому порту вы будете обращаться из клиентского js
	srvdir:__dirname + '/frontend'	// содержимое этой папки будете показывать людям, не выкладывайте туда компромат :-)
};

var socketIoOptions = {
//	'log level': 0
};

var UM = require("./UsersManagerLearn.js");
var um = UM.CreateUsersManager(); //когда-нибудь в аргументах будут настройки

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var http = require('http');
var server = http.createServer(app); // неочевидное - мы создаём новый сервер, добавляем requestListener созданный express-ом,
var io = require('socket.io').listen(server, socketIoOptions); // а потом этот же порт начинает слушать ещё и socket.io
server.listen(config.PORT);

app.use(bodyParser.urlencoded({ extended: false }));  // parse application/x-www-form-urlencoded:
// app.use(bodyParser.json()); // включить если в post-запросах планируется приём json-структур

app.get('/', function (req, res) {
	res.sendFile(config.srvdir + '/index.html');
	console.log(Date()+" - запрошена главная страница");
});

// регистрация через api требует указать ник, пароль и почтовый ящик для обратной связи
app.post('/api1/registration', function(req ,res) {
	res.header('Access-Control-Allow-Origin','*'); // разрешим кроссдоменные запросы (todo - только для разрешённых сайтов)
	//console.dir(req.body);
	var params = req.body;
	console.dir(params);
	um.registration(req, params, res); // функция должна сама взять параметры из body и сформировать ответ (возможно не сразу)
	// регистрацией занимается UserManager, он в свою очередь может обратиться ещё к кому-то (бд или другие внешние сервисы)
});

// такой вариант авторизации допустим только для операторов или других профилей без ограничений на один IP
// его использование вообще не очень рекомендовано, это скорее отладочный интерфейс, на случай если лежит "Кучка"
app.post('/api1/dclogin', function(req, res){
	var nick = req.body.n; // поле ника обязательно
	var pass = req.body.p; // поле пароля может быть пустым или вовсе отсутствовать
	var token = req.body.token; // если у клиента уже есть корректный токен (id сессии),сервер попробует просто восстановить её
	res.header('Access-Control-Allow-Origin','*'); // разрешим кроссдоменные запросы (todo - только для разрешённых сайтов)
	if(nick && nick!="")
	{
		um.initToken(req, res, nick, pass, token); // менеджер должен САМ вернуть структуру с токеном или ошибкой
		// req передаю на случай, если понадобится проверка ещё каких-то полей (куки, айпи и т.д.)
	}
	else
		res.send({ err:true, answ:"Не указан логин" });
	//res.redirect('back'); // пригодится для html-запросов, но это чистое api
});

io.sockets.on('connection', function(client) 
{
	console.log(client.handshake); // данные "рукопожатия" при инициализации веб-сокета (почти обычные get-параметры)
	
	var nick = client.handshake.query.n;
	if(nick == undefined) 
		{	client.disconnect();
			client.emit('message', 'nick?');
			return;
		};
	
	var pass = client.handshake.query.p || "";
	var token = client.handshake.query.token || "";
	
	um.initSocket(client, nick, pass, token); //навесит на сокет обработчики, если это разрешено для данного юзера
	//...и теоретически может разрешить авторизацию и прямо по веб-сокету
});

// обращение к файловой системе должно идти в последнюю очередь, чтобы сначала проверялись команды:
app.use(express.static(config.srvdir, {
	setHeaders: function(res, path, stat) {
		res.header('Access-Control-Allow-Origin','*');
		//res.header('Content-Type', 'windows-1215');  // без этого он отдаёт utf-8 даже для файлов, где внутри указана кодировка, а а сним - хром не понимает тип css-файлоов
	}
}));

// что-нибудь напишем чтобы понять, что скрипт выполнился и начал слушать события:
console.log(Date()+ " - сервер запущен, порт " + config.PORT);