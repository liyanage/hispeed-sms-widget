<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output omit-xml-declaration='yes'/>
<xsl:template match="/*">
<xsl:value-of select="//string[preceding-sibling::key[1] = 'CFBundleVersion']"/>
</xsl:template>
</xsl:stylesheet>
