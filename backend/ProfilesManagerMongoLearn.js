
var mongo = require('mongodb');
var mongo_host = 'localhost';
var mongo_port = 27017;

// объект для работы с монго-базой:
var db =  new mongo.Db('test', new mongo.Server(mongo_host, mongo_port, {} ), {safe:false});


//-----------------------------------------------------------------------------
//---- поля и методы для подстраховочной работы с файлом профилей (помимо базы) ---

var profiles = { }; // словарь зарегистрированных юзеров, ключи - ники, значения - структуры из ника, пароля, почтового адреса и т.д.
var fs = require('fs'); // для сохранения профилей просто в файле
var profileFileName = __dirname + '/profiles.json'; // в этом файле они хранятся по умолчанию, но можно изменить в настройках

// загружает страховочный дубль набора профилей из файла при старте:
function loadProfiles()
{
	var contents = fs.readFileSync(profileFileName, 'utf8');
	console.log("Загружен файл профилей: " + profileFileName); //console.log("Загружен файл профилей: "+contents);
	profiles = JSON.parse(contents);
	// файл грузится один раз при старте, необходимости в асинхронной операции нету
};

// пустышка для общности с версией менеджера профилей чисто на файлах:
function saveProfiles() {};
	
// для дублирования изменений профилей в файле (для удобства и подстраховки):
function setProfileInFile(nick,p)
{
	var oldp = profiles[nick];
	profiles[nick] = p;
	fs.writeFile(profileFileName, JSON.stringify(profiles), function(err) {
		if(err) {
			console.log("Проблемы сохранения файла профилей "+profileFileName);
			profiles[nick] = oldp; // при проблемах мы не имеем права хранить новые данные, вернём старые
		} else {
			console.log("Записан файл профилей "+ profileFileName);
		};
	});
}


//-----------------------------------------------------------------------------
//---- поля и методы работы с MONGODB

// возвращает по нику профиль в callback(err, profile):
function getProfile(nick, callback)
{
	db.open(function(err, db) {
		if(err) {
			//callback(true);
			callback(false, profiles[nick]); // если не работает база, вернём профиль из файла
			// это допустимо только для чтения и при недоступности базы (наверное)
			console.log("Нет связи с bd, профиль "+ nick + " отдан из файла");
			// можно было бы всегда отдавать из оперативного кэша, но вдруг в базу пишет кто-то ещё кроме нас?
			return; 
		};
		
		var collection = db.collection("simple_collection");
		collection.findOne({nick:nick}, function(err, item) {
			db.close(); // связь с базой закрываем в колбэке запроса
			if(err) {
				console.log(err);
				callback(true);
			}
			else callback(false,item);
		});
	});
}

// записывает по нику профиль, результат - в callback(err):
function setProfile(nick, p, callback)
{	// при каждом изменении профиля - перезаписываем файл (можно даже дублировать ещё где-то)
	
	db.open(function(err, db) {
		if(err) { callback(true); return; };
		
		var collection = db.collection("simple_collection");
		collection.findOne({nick:nick}, function(err, item) {
			if (item==null){
				collection.insert(p, {w:1}, function(err, result) {
					db.close(); // связь с базой закрываем в самом глубоком колбэке запроса
					callback(err);
					if(!err) setProfileInFile(nick,p); // дубль в файл
				});
			}
			else
			{	p._id = item._id;
				collection.updateOne({ _id:item._id}, p, {upsert:true,w:1}, function(err, result) {
					db.close(); // связь с базой закрываем в самом глубоком колбэке запроса
					callback(err);
					if(!err) setProfileInFile(nick,p); // дубль в файл
				});
			};
		});
	});
}

// экспортная функция, запускает модуль и возвращает обьект со всеми методами, которыем мы хотим экспортировать:
function CreateProfilesManager(options) 
{
	profileFileName = profileFileName || options.profileFileName;
	
	var pm = {
		saveProfiles: saveProfiles,
		loadProfiles: loadProfiles,
		getProfile:getProfile,
		setProfile:setProfile
	};
	
	loadProfiles(); // загрузим профили сразу
	
	return pm;
}

exports.CreateProfilesManager = CreateProfilesManager;