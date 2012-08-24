#!/usr/bin/perl

use strict;
use warnings;

chomp(my $user = qx(/usr/bin/whoami));
print STDERR "User: $user\n";

chomp(my $homedir = qx(/usr/bin/dscl . -read /users/$user NFSHomeDirectory | cut -f2 -d' '));
print STDERR "Homedir: $homedir\n";

chomp(my $os_version = qx(/usr/bin/uname -r | cut -f1 -d'.'));
print STDERR "OS Version: $os_version\n";

# If the OS is newer than Snow Leopard (major version 10) the
# address book data file is stored under Sources/<some UUID>.
# Otherwise it's just directly in the app support directory.
my $datapath = "$homedir/Library/Application Support/AddressBook";
if ($os_version > 10) {
	chomp(my $default_source = qx(/usr/bin/defaults read com.apple.AddressBook ABDefaultSourceID));
	$datapath .= "/Sources/$default_source";
}
print STDERR "Data path: $datapath\n";

my $abook_query = "SELECT pn.zfullnumber, r.zfirstname, r.zlastname FROM ZABCDPHONENUMBER pn JOIN ZABCDRECORD r ON pn.zowner = r.z_pk WHERE pn.zlabel LIKE '%<Mobile>%' ORDER by r.zfirstname, r.zlastname;";
my $data = qx(sqlite3 -line "$datapath/AddressBook-v22.abcddb" "$abook_query");

my @records =
	map {$_ =~ s/"/\\"/g; qq("$_")}
	map {"$_->[1] $_->[2] - $_->[0]"}
	map {$_->[0] =~ s/ //g; $_}
	map {[/^[^=]+= (.*)/mg]}
	split(/\n\n/, $data);

print STDERR "Found " . scalar(@records) . " address book records\n";

print "[\n";
print join ", \n", @records;
print "\n]\n";
