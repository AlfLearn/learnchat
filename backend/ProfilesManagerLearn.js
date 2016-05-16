
var profiles = { }; // словарь зарегистрированных юзеров, ключи - ники, значения - структуры из ника, пароля, почтового адреса и т.д.

var fs = require('fs'); // для сохранения профилей просто в файле
var profileFileName = __dirname + '/profiles.json'; // в этом файле они хранятся по умолчанию, но можно изменить в настройках

function saveProfiles(callback)
{
	//fs.writeFileSync(profileFileName, JSON.stringify(profiles), { flag:'w' } ); // {encoding:enc} ); // это была синхронная версия
	
	fs.writeFile(profileFileName, JSON.stringify(profiles), function(err) {
		if(err) {
			console.log("Проблемы сохранения файла профилей "+profileFileName);
			callback(true);
		} else {
			console.log("Записан файл профилей "+ profileFileName);
			callback(false);
		};
	});
};

function loadProfiles()
{
	var contents = fs.readFileSync(profileFileName, 'utf8');
	console.log("Загружен файл профилей: "+contents);
	profiles = JSON.parse(contents);
	// файл грузится один раз при старте, необходимости в асинхронной операции нету
}

function getProfile(nick, callback)
{
	//return profiles[nick]; // это была синхронная версия
	callback(false, profiles[nick]);
	// особой необходимости в колбэке тут нету, но сделано для единого интерфейса с реализацией на mongodb
}

function setProfile(nick, p, callback)
{	// при каждом изменении профиля - перезаписываем файл (можно даже дублировать ещё где-то)
	
	// profiles[nick] = p; saveProfiles(); // это была синхронная версия
	
	var oldp = profiles[nick];
	profiles[nick] = p;
	fs.writeFile(profileFileName, JSON.stringify(profiles), function(err) {
		if(err) {
			console.log("Проблемы сохранения файла профилей "+profileFileName);
			profiles[nick] = oldp; // при проблемах мы не имеем права хранить новые данные, вернём старые
			callback(true);
		} else {
			console.log("Записан файл профилей "+ profileFileName);
			callback(false);
		};
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