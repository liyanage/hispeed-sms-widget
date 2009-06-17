
/*
	cablecom hispeed SMS widget
	
	Written by Marc Liyanage <http://www.entropy.ch>
	Multiple send bug and Keychain fixes and lots of testing and debugging by Joe Scherler
 */



var flipShown = false;


var animation = {duration:0, starttime:0, to:1.0, now:0.0, from:0.0, firstElement:null, timer:null};

var last = {message:null, number:null};
var globalGlueCookie;
var globalServicePoints;
var globalOsVersion;
var globalUserName;
var globalProxyString;



Autocompleter.AddressBook = Class.create(Autocompleter.Local, {

	addressBookDataMaxAgeSeconds: 10,

  initialize: function(element, update, options) {
    this.baseInitialize(element, update, options);
//  	this.updateAddressBookArray();
  },

  getUpdatedChoices: function() {
  	this.updateAddressBookData();
  },

  updateAddressBookData: function() {
	if (this.addressBookDataIsUpToDate()) {
		this.updateChoices(this.options.selector(this));
		return;
	}
	
	alert('reading address book data');
	var result = widget.system("/bin/pwd", null);
	var match = result.outputString.match(/^(.+)/);
	var pwd = match[1];
	var cmd = "umask 077; /usr/bin/perl " + pwd + "/addressbook2json.pl > /tmp/abook_$USER.js";
	widget.system(cmd, this.updateAddressBookDataSystemCallback.bind(this));

  },

  updateAddressBookDataSystemCallback: function (systemCall) {
	new Ajax.Request('file:///tmp/abook_' + globalUserName + '.js', {
		onComplete: this.updateAddressBookDataXhrCallback.bind(this)
	});
  },


  updateAddressBookDataXhrCallback: function (xhr) {
	try {
		var addressBookData = eval('(' + xhr.responseText + ')');
	} catch (e) {
		alert('Exception: ' + e);
		return;
	}
	
	this.addressBookDataUpdateTime = new Date().getTime();
	this.options.array = addressBookData;
	this.updateChoices(this.options.selector(this));
  },


  addressBookDataIsUpToDate: function() {
  	if (!this.addressBookDataUpdateTime) return false;
  	var addressBookDataAgeSeconds = (new Date().getTime() - this.addressBookDataUpdateTime) / 1000;
  	return addressBookDataAgeSeconds < this.addressBookDataMaxAgeSeconds;
  }


});


function setup() {
	$("input_username").value = widget.preferenceForKey("username");
	var recentNumber = widget.preferenceForKey("number");
	$("input_number").value = recentNumber || '';
	createGenericButton($('done'), localizedString('done'), hideBack);
	createGenericButton($('send_sms'), localizedString('send'), send_sms);
	update_msg_charcount();
	
	localizeStrings();
	findWidgetVersion();
	setupOsVersion();
	setupUserName();
	setupAutoCompletion();
    
}

function setupOsVersion() {
	var result = widget.system("/usr/bin/uname -r | /usr/bin/cut -f1 -d'.'", null);
	globalOsVersion = result.outputString.match(/^(.+)/)[1];
}

function setupUserName() {
	var result = widget.system("echo $USER", null);
	globalUserName = result.outputString.match(/^(.+)/)[1];
}

function setupAutoCompletion() {
	if (globalOsVersion < 9) return;
	new Autocompleter.AddressBook('input_number', 'input_number_list', {choices: 6, fullSearch: true, afterUpdateElement: autocompleterUpdate});
}

function setupProxy(result) {
    // First find if there is a proxy configured
    var result = widget.system("/usr/sbin/scutil --proxy", null);
    var useHttpProxy = result.outputString.match(/HTTPEnable : 1/);
    if (useHttpProxy) {
        var proxyHost = result.outputString.match(/HTTPProxy : (.+)\n/)[1];
        var proxyPort = result.outputString.match(/HTTPPort : (\d+)\n/)[1];
        globalProxyString = " --proxy " + proxyHost + ":" + proxyPort;
        
        // Now look if there is a password for the proxy configuration
        var secResult = widget.system("/usr/bin/security -q find-internet-password -g -s " + proxyHost,null);
        // status will be non-zero if the host is not found or the user deny access to the keychain
        if (secResult.status == 0) {
            var proxyUser = secResult.outputString.match(/"acct"<blob>="(.+)"/)[1];
            // for some reason, the password info is sent to stderr
            var proxyPass = secResult.errorString.match(/^password: "(.+)"/)[1];
            globalProxyString += " --proxy-user " + proxyUser + ":" + proxyPass;
        }
        alert("Proxy String: '" + globalProxyString + "'");
    } else {
        globalProxyString = "";
    }
}

function autocompleterUpdate() {
	var value = $('input_number').value;
	var match = value.match(/^(.+?) - (.+)/);
	var name = match[1];
	var number = match[2];
	nameAndNumberPick(name, number);
}


function localizeStrings() {
	localizeElementsByName('span', 'id', 'label', updater_text_content);
	localizeElementsByName('a', 'title', 'title', updater_attribute_value);
	localizeElementsByName('textarea', 'id', 'input', updater_text_content);
	localizeElementsByName('td', 'id', 'label', updater_text_content);
}

function localizeElementsByName(name, attribute, prefix, updater) {

	var elements = document.getElementsByTagName(name);
	var re = new RegExp('^' + prefix + '_(\\w+)$');
	for (var i = 0; i < elements.length; i++) {
		var elem = elements.item(i);
		var attrvalue = elem.getAttribute(attribute);
		if (!attrvalue) continue;
		var match = re.exec(attrvalue);
		if (!(match && (match.length == 2))) continue;
		var label_id = match[1];
		var string = localizedString(label_id);
		updater(elem, attribute, string);
	}
}

function updater_attribute_value(element, attribute, value) {
	element.setAttribute(attribute, value);
}

function updater_text_content(element, attribute, value) {
	element.appendChild(document.createTextNode(value));
}





function send_sms() {
	
	var message = $("input_message").value;
	var number = $("input_number").value;

	if (!message) {
		set_statusmessage_error(localizedString('nomessage'));
		return;
	}

	if (!number) {
		set_statusmessage_error(localizedString('nonumber'));
		return;
	}

	if (last.message && message == last.message)
	{
		if (last.number && number == last.number)
		{
			// set_statusmessage_error("Same message/number as before...");
			return;
		}
	}

	last.message = message;
	last.number  = number;
	
	widget.setPreferenceForKey(number, "number");

    setupProxy();
	do_login(do_send_sms);


}




function do_send_sms() {

	// Ensure that there are enough service points left
	// This assumes that the request object has just been used to fetch the SMS form

	if (globalServicePoints < 25) {
		set_statusmessage_error(localizedString('notenoughpoints'));
		return;
	}

	/* Try to send the message */
	
	var match = globalGlueCookie.match(/JSESSIONID=(\w+)/);
	if (!match) {
	    localizedString('errorsending');
		alert('Unable to find JSESSIONID in cookie value: ' + globalGlueCookie);
		return;
	}
	var sessionId = match[1];

//	alert("*** debug 1: " + sessionId);
//	alert("*** debug 2: " + globalGlueCookie);

	var url = "http://messenger.hispeed.ch/walrus/app/sms_send.do;jsessionid=" + sessionId;
//	alert("*** url: " + url);

	var escapedMessage = encodeURIComponent(last.message).replace(/'/g, '%27');

	var body = "hostname=your.hispeed.ch&action=send&groupName=%3A%3A__DEFAULTGROUP__%3A%3A&message=" + escapedMessage + "&numCount=&sendDate=&sendTime=&notifAddress=notifNone&originator=originatorUser&recipientChecked=yes&recipient=" + last.number;
//	alert("*** body: " + body);
	var cmd = "/usr/bin/curl -q -s -i --cookie '" + globalGlueCookie + "' --header 'X-Widget-Request: true' --data-binary '" + body + "'" +
        globalProxyString + " '" + url + "'";
//	alert("*** cmd: " + cmd);

	widget.system(cmd, do_send_sms_system_handler);
	
	return;
	
	// XHR is broken on Leopard 10.5.1/2, cannot set Cookie header, uses Safari's values instead.
// 	var request = new XMLHttpRequest();
// 	request.setRequestHeader("Cookie", globalGlueCookie);
// 	request.open("POST", url, false);
// //	var body = "hostname=your.hispeed.ch&action=send&groupName=%3A%3A__DEFAULTGROUP__%3A%3A&message=" + last.message + "&numCount=&sendDate=&sendTime=&notifAddress=notifNone&originator=originatorUser&recipientChecked=yes&recipient=" + last.number;
// 	var body = "hostname=your.hispeed.ch&action=send&groupName=%3A%3A__DEFAULTGROUP__%3A%3A&message=" + escape(last.message) + "&numCount=&sendDate=&sendTime=&notifAddress=notifNone&originator=originatorUser&recipientChecked=yes&recipient=" + last.number;
// 	request.send(body);
// 
// 	if (request.responseText.match(/Sendeauftrag erfolgreich/)) {
// 		get_servicepoints(request.responseText);
// 		set_statusmessage(localizedString('smssent'));
// 	} else {
// 		set_statusmessage_error(localizedString('errorsending'));
// 		alert('error sending sms. response status/body: ' + request.status + '/' + request.responseText)
// 	}	

}



function do_send_sms_system_handler(systemCommand) {

	var stdout = systemCommand.outputString;
	var stderr = systemCommand.errorString;

	if (systemCommand.status != 0) {
		set_statusmessage_error(localizedString('errorsending'));
		alert('error sending sms. non-zero curl exit status ' + systemCommand.status + ', stdout: ' + stdout + ', stderr: ' + stderr);
		return;	    
	}

	if (!(stdout && stdout.match(/Sendeauftrag erfolgreich/))) {
		set_statusmessage_error(localizedString('errorsending'));
		alert("error sending sms. Server response doesn't contain confirmation string, stdout: " + stdout + ', stderr: ' + stderr);
		return;
	}

	get_servicepoints(stdout);
	set_statusmessage(localizedString('smssent'));

}





function do_login(success_handler) {
	
	globalGlueCookie = null;
	globalServicePoints = 0;
	globalDoLoginSuccessHandler = success_handler;
	
	/* The external system() / curl stuff is a workaround because dashboard
   	   widgets currently don't send back cookies properly */

	var command_line;

	/* step 1, establish session */
	command_line = "/usr/bin/curl -q -s -i --cookie 'TornadoAuth=test' --header 'X-Widget-Request: true' " + globalProxyString +
        " -d url=http://your.hispeed.ch/dummy http://your.hispeed.ch/setcookie.cgi";
	widget.system(command_line, systemHandlerStage1);

	set_statusmessage(localizedString('loggingin1'));
	
	return;

}




function systemHandlerStage1(systemCall) {
	
    if (systemCall.status) {
        last.message = "";
        last.number = "";
        set_statusmessage_error(localizedString('networkfailed'));
        return null;
    }
    
	output = systemCall.outputString;
	matches = output.match(/Set-Cookie: (.+);/m);
	if (!matches) {
		set_statusmessage_error("Internal error, no cookie 1");
		return null;
	}
	var cookie = matches[1];

	/* step 2, authenticate session */

	var username = $("input_username").value;
	if (!username) {
		set_statusmessage_error(localizedString('nousername'));
		return null;
	}

	widget.setPreferenceForKey(username, "username");
	var password = $("input_password").value;

	if (!password) {
		var command_line = "/usr/bin/security -q find-internet-password -g -s your.hispeed.ch -a '" + username + "'";

		var result = widget.system(command_line, null);
		if (result.status) {
			alert("keychain lookup command line: " + command_line);
			alert("keychain lookup result:       " + result.status);
			alert("keychain lookup error:        " + result.errorString); // security tool dumps its output to stderr insted of stdout...
			alert("keychain lookup output:       " + result.outputString);
			set_statusmessage_error(localizedString('enterpassword'));
			return null;
		}

		var matches = result.errorString.match(/^password: "(.+)"/);
		if (matches) {
			password = matches[1];
			$("input_password").value = password;
		}
	}	

		
	if (!password) {
		set_statusmessage_error(localizedString('nopassword'));
		return null;
	}

	// fixme: need to escape single quotes in auth_postdata before passing to shell
	var auth_postdata = "url=http://your.hispeed.ch/dummy&mail=" + escape(username) + "&password=" + escape(password);
	var command_line = "/usr/bin/curl -q -s -i --cookie '" + cookie + "' --header 'X-Widget-Request: true' -d '" + auth_postdata + "'" +
        globalProxyString + " http://your.hispeed.ch/setcookie.cgi";

	widget.system(command_line, systemHandlerStage2);

	set_statusmessage(localizedString('loggingin2'));

	return;

}



function systemHandlerStage2(systemCall) {

	var output = systemCall.outputString;
	var matches = output.match(/Set-Cookie: (.+);/m);
	if (!matches) {
		set_statusmessage_error("Internal error, no cookie 2");
		return null;
	}
	cookie = matches[1];

	/* step 3, check authentication and get glue cookie */
	var command_line = "/usr/bin/curl -q -s -i -L --cookie '" + cookie + "' --header 'X-Widget-Request: true'" + globalProxyString +
        " 'http://your.hispeed.ch/glue.cgi?http://messenger.hispeed.ch/walrus/app/login.do?language=de&hostname=your.hispeed.ch'";
	widget.system(command_line, systemHandlerStage3);
	
	set_statusmessage(localizedString('loggingin3'));
	
	return;

}



function systemHandlerStage3(systemCall) {

	var output = systemCall.outputString;
	var matches = output.match(/Set-Cookie: (JSESSIONID=.+);/m);
	if (!matches) {
		alert("glue.cgi command_line: " + command_line);
		alert("glue.cgi status:       " + result.status);
		alert("glue.cgi output:       " + output);
		alert("glue.cgi error:        " + result.errorString);
		set_statusmessage_error(localizedString('loginfailed'));
		return null;
	}
	cookie = matches[1];

	set_statusmessage(localizedString('loggedin'));

	globalGlueCookie = cookie;
	get_servicepoints(output);
	
	if (globalDoLoginSuccessHandler) globalDoLoginSuccessHandler();

}



function findWidgetVersion() {
	var result = widget.system("/bin/pwd", null);
	var match = result.outputString.match(/^(.+)/);
	var pwd = match[1];

	var command_line = "xsltproc '" + pwd + "/infoplist2version.xslt' '" + pwd + "/Info.plist'";
	widget.system(command_line, systemHandlerVersion);
}



function systemHandlerVersion(systemCall) {

	if (systemCall.status || systemCall.errorString) {
		alert("xsltproc failed, unable to get version");
		alert("status: " + systemCall.status);
		alert("stderr:  " + systemCall.errorString);
		alert("stdout:  " + systemCall.outputString);
		return;
	}

	var version = systemCall.outputString;
	$('version').appendChild(document.createTextNode(version));
}


function showAddressBook() {

	var result = widget.system("/bin/pwd", null);
	var pwd = result.outputString.match(/^(.+)/)[1];
	
	if (globalOsVersion < 9) {
		// Use niutil read instead of ~ or $HOME because those seem
		// to be broken if a user's home directory is not "/Users/<username>".
		var command_line = "umask 077; (echo '<root>'; cat $(niutil -readprop . /users/$USER home)/Library/Caches/com.apple.AddressBook/MetaData/*.abcdp | grep -v '<?xml' | grep -v '<!DOCTYPE'; echo '</root>' ) | xsltproc '" + pwd + "/addressbook2html.xslt' - > /tmp/abook_$USER.html";
	} else {
		var command_line = "umask 077; /bin/sh " + pwd + "/addressbook2html.sh > /tmp/abook_$USER.html";
	}

	widget.system(command_line, systemHandlerAddressBook);
}



function systemHandlerAddressBook(systemCall) {

	if (systemCall.status || systemCall.errorString) {
		alert("xsltproc failed, unable to gather address book entries");
		alert("status: " + result.status);
		alert("stderr:  " + result.errorString);
		alert("stdout:  " + result.outputString);
		set_statusmessage_error("Unable to read Address Book");
		return;
	}

	new Ajax.Request('file:///tmp/abook_' + globalUserName + '.html', {
		onComplete: addressbook2HtmlFileReadCallback
	});
}



function addressbook2HtmlFileReadCallback(xhr) {
	var html = xhr.responseText;
	$('input_number').style.display = 'none';
	$('abook_div').update(html);
	$('abook').focus();
	$('label_abook').appendChild(document.createTextNode(localizedString('abook')));
	set_statusmessage('');
}



function AddressBookPick() {
	var abook = $('abook');
	var number = abook.value;
	var name = abook.options.item(abook.selectedIndex).innerHTML;
	nameAndNumberPick(name, number);
}



function nameAndNumberPick(name, number) {
	number = number.replace(/[^0-9+]/g, "");

	if (number.match(/^\+41/)) {
		number = number.replace(/^\+41/, "0");
	} else if (number.match(/^\+/)) {
		number = number.replace(/^\+/, "00");
	}

	$('input_number').style.display = 'inline';
	$("input_number").value = number;
	$("input_number").setAttribute("title", name);
	$('abook_div').update();

	$('input_message').focus();
}



function inputNumberChanged() {
	$("input_number").setAttribute("title", "");
}


function inputNumberOver() {
	var title = $("input_number").getAttribute("title");
	if (title) {
		var match = title.match(/^(.+) - /);
	    if (match) set_statusmessage(match[1]);
	}
}

function inputNumberOut() {
	set_statusmessage('');
}





function update_servicepoints_status() {
    setupProxy();
	do_login();
}


function update_msg_charcount() {

	var message = $("input_message").value;
	
	var charsleft = 160 - message.length;
//	self.setTimeout('set_statusmessage("' + charsleft + ' characters left")', 500);

	if (charsleft > 0) {
		self.setTimeout('set_statusmessage("' + charsleft + ' ' + localizedString('charsleft') + '")', 0);
		$('send_sms').style.display = 'block';
	} else {
		set_statusmessage_error(localizedString('toolong'));
		$('send_sms').style.display = 'none';
	}

}



function set_statusmessage_error(message) {
	set_statusmessage(message, "white");
}


function set_statusmessage(message, color) {
	var span = $('statusmessage');
	span.update(message);
	
	if (color) {
		span.style.color = color;
	} else {
		span.style.color = "black";
	}

}





function set_servicepoints_status(servicepoints) {
	var span = $('label_servicepoints');
	var text = servicepoints >= 25 ? servicepoints : servicepoints + ' (' + localizedString('notenoughpoints') + ')';
	span.replaceChild(document.createTextNode(servicepoints), span.firstChild);
}



function get_servicepoints(html) {
	var pointsregex = /<td>&nbsp;(\d+)<\/td>/i;
	var matches = html.match(pointsregex);
	globalServicePoints = matches[1];
	set_servicepoints_status(globalServicePoints);

	set_statusmessage(globalServicePoints + " " + localizedString('servicepointsleft'));

	return globalServicePoints;
}



/* Widget visual effects functions */

function showBack() {
    var front = $("front");
    var back = $("back");
        
    if (window.widget)
        widget.prepareForTransition("ToBack");
                
    front.style.display="none";
    back.style.display="block";
        
    if (window.widget)
        setTimeout ('widget.performTransition();', 0);  
}


function hideBack()

{

    var front = $("front");

    var back = $("back");

        

    if (window.widget)

        widget.prepareForTransition("ToFront");

                

    back.style.display="none";

    front.style.display="block";

        

    if (window.widget)

        setTimeout ('widget.performTransition();', 0);

}


function mousemove (event)
{
    if (!flipShown)
    {
        if (animation.timer != null)
        {
            clearInterval (animation.timer);
            animation.timer  = null;
        }
                
        var starttime = (new Date).getTime() - 13;
                
        animation.duration = 500;
        animation.starttime = starttime;
        animation.firstElement = $ ('flip');
        animation.timer = setInterval ("animate();", 13);
        animation.from = animation.now;
        animation.to = 1.0;
        animate();
        flipShown = true;
    }
}

function mouseexit (event)
{
    if (flipShown)
    {
        // fade in the info button
        if (animation.timer != null)
        {
            clearInterval (animation.timer);
            animation.timer  = null;
        }
                
        var starttime = (new Date).getTime() - 13;
                
        animation.duration = 500;
        animation.starttime = starttime;
        animation.firstElement = $ ('flip');
        animation.timer = setInterval ("animate();", 13);
        animation.from = animation.now;
        animation.to = 0.0;
        animate();
        flipShown = false;
    }
}

function animate()
{
    var T;
    var ease;
    var time = (new Date).getTime();
                
        
    T = limit_3(time-animation.starttime, 0, animation.duration);
        
    if (T >= animation.duration)
    {
        clearInterval (animation.timer);
        animation.timer = null;
        animation.now = animation.to;
    }
    else
    {
        ease = 0.5 - (0.5 * Math.cos(Math.PI * T / animation.duration));
        animation.now = computeNextFloat (animation.from, animation.to, ease);
    }
        
    animation.firstElement.style.opacity = animation.now;
}

function limit_3 (a, b, c)
{
    return a < b ? b : (a > c ? c : a);
}

function computeNextFloat (from, to, ease)
{
    return from + (to - from) * ease;
}


function enterflip(event)
{
    $('fliprollie').style.display = 'block';
}

function exitflip(event)
{
    $('fliprollie').style.display = 'none';
}


function localizedString(key)
{
	try {
		var ret = localizedStrings[key];
		if (ret === undefined)
			ret = key;
		return ret;
	} catch (ex) {}
	return key;
}

