#!/usr/bin/perl

use strict;
use warnings;
# use Data::Dumper;
# 
# $Data::Dumper::Pair = ' : ';
# $Data::Dumper::Terse = 1;
# $Data::Dumper::Useqq = 1;

my $homedir = qx(/usr/bin/dscl . -read /users/$ENV{USER} NFSHomeDirectory | cut -f2 -d' ');
chomp $homedir;
my $data = qx(sqlite3 -line "$homedir/Library/Application Support/AddressBook/AddressBook-v22.abcddb" "SELECT pn.zfullnumber, r.zfirstname, r.zlastname FROM ZABCDPHONENUMBER pn JOIN ZABCDRECORD r ON pn.zowner = r.z_pk WHERE pn.zlabel LIKE '%<Mobile>%' ORDER by r.zfirstname, r.zlastname;");
my @records =
	map {$_ =~ s/"/\\"/g; qq("$_")}
	map {"$_->[1] $_->[2] - $_->[0]"}
	map {$_->[0] =~ s/ //g; $_}
	map {[/^[^=]+= (.+)/mg]}
	split(/\n\n/, $data);

print "[\n";
print join ", \n", @records;
print "\n]\n";



#$| = 1;
#print Data::Dumper->Dump([\@records]);

#print "@records";
#print $data;
